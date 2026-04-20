import orderModel from "../model/order.model.js";
import paymentModel from "../model/payment.model.js";
import mongoose from "mongoose";
import crypto from "crypto";
import {
  finalizeReservedStock,
  releaseReservedStock,
  reserveStock,
} from "../services/payment/stock.service.js";
import {
  createVNPayUrl,
  mapVNPayResponseMessage,
  verifyVNPayCallback,
} from "../services/payment/vnpay.service.js";
import userModel from "../model/user.model.js";
import { sendOrderSuccessEmail } from "../utils/user.util.js";
import { incDailyStats } from "../utils/dashboard.util.js";
import { createAndEmitNotification } from "../services/notification/notification.service.js";

const PAYMENT_EXPIRE_MINUTES = 15;

const appendPurchaseHistoryAndSendMail = async (order) => {
  await userModel.updateOne(
    { _id: order.userId },
    {
      $push: {
        purchaseHistory: {
          orderId: order._id,
          purchasedAt: order.paidAt || new Date(),
          totalAmount: order.total,
          status: "paid",
          items: order.items.map((i) => ({
            productName: i.nameSnapshot,
            quantity: i.quantity,
            size: i.size,
            color: i.color,
            unitPrice: i.price,
          })),
        },
      },
    }
  );

  const user = await userModel.findById(order.userId);
  if (user) {
    await sendOrderSuccessEmail({ user, order });
  }
};

const upsertVNPayProcessing = async (order) => {
  const expiresAt = new Date(Date.now() + PAYMENT_EXPIRE_MINUTES * 60 * 1000);

  const payment = await paymentModel.findOneAndUpdate(
    { orderId: order._id, provider: "vnpay" },
    {
      orderId: order._id,
      userId: order.userId,
      provider: "vnpay",
      amount: order.total,
      status: "processing",
      txnRef: order.orderCode,
      expiresAt,
    },
    { upsert: true, new: true }
  );

  order.paymentId = payment._id;
  order.paymentStatus = "processing";
  await order.save();

  return payment;
};

const processVNPayResult = async (params) => {
  let order = await orderModel.findOne({ orderCode: params.vnp_TxnRef });

  if (!order && mongoose.Types.ObjectId.isValid(params.vnp_TxnRef)) {
    order = await orderModel.findById(params.vnp_TxnRef);
  }

  if (!order) {
    const paymentByTxnRef = await paymentModel
      .findOne({ provider: "vnpay", txnRef: params.vnp_TxnRef })
      .select("orderId");

    if (paymentByTxnRef?.orderId) {
      order = await orderModel.findById(paymentByTxnRef.orderId);
    }
  }

  if (!order) return { ok: false, code: "01", message: "Order not found" };

  const payment = await paymentModel.findOne({
    orderId: order._id,
    provider: "vnpay",
  });
  if (!payment) return { ok: false, code: "01", message: "Payment not found" };

  if (order.paymentStatus === "paid" || payment.status === "success") {
    return {
      ok: true,
      code: "02",
      message: "Already paid",
      responseCode: params.vnp_ResponseCode,
      order,
    };
  }

  const paidAmount = Number(params.vnp_Amount || 0) / 100;
  if (Math.abs(paidAmount - Number(order.total || 0)) > 1) {
    return { ok: false, code: "04", message: "Invalid amount" };
  }

  const isSuccess =
    params.vnp_ResponseCode === "00" && params.vnp_TransactionStatus === "00";

  payment.transactionId = params.vnp_TransactionNo;
  payment.gatewayResponse = params;

  if (isSuccess) {
    payment.status = "success";

    order.paymentStatus = "paid";
    order.orderStatus = "paid";
    order.transactionId = params.vnp_TransactionNo;
    order.paidAt = new Date();

    await payment.save();
    await order.save();
    await finalizeReservedStock(order.items);
    await incDailyStats({
      date: order.paidAt,
      revenue: order.total,
      orders: 1,
    });
    await appendPurchaseHistoryAndSendMail(order);
    await createAndEmitNotification({
      type: "order_paid",
      title: "Order paid",
      message: `Order ${order.orderCode} has been paid`,
      data: {
        orderId: order._id,
        orderCode: order.orderCode,
        total: order.total,
      },
    });

    return {
      ok: true,
      code: "00",
      message: "Success",
      responseCode: params.vnp_ResponseCode,
      order,
    };
  }

  payment.status = "failed";
  order.paymentStatus = "failed";
  // keep order as pending so user can retry payment
  order.orderStatus = "pending";

  await payment.save();
  await order.save();
  await releaseReservedStock(order.items);

  return {
    ok: true,
    code: "00",
    message: mapVNPayResponseMessage(params.vnp_ResponseCode),
    responseCode: params.vnp_ResponseCode,
    order,
  };
};

const verifyMoMoSignature = (data = {}) => {
  const rawSignature =
    `accessKey=${process.env.MOMO_ACCESS_KEY}` +
    `&amount=${data.amount || ""}` +
    `&extraData=${data.extraData || ""}` +
    `&message=${data.message || ""}` +
    `&orderId=${data.orderId || ""}` +
    `&orderInfo=${data.orderInfo || ""}` +
    `&orderType=${data.orderType || ""}` +
    `&partnerCode=${data.partnerCode || ""}` +
    `&payType=${data.payType || ""}` +
    `&requestId=${data.requestId || ""}` +
    `&responseTime=${data.responseTime || ""}` +
    `&resultCode=${data.resultCode ?? ""}` +
    `&transId=${data.transId ?? ""}`;

  const signature = crypto
    .createHmac("sha256", process.env.MOMO_SECRET_KEY)
    .update(rawSignature)
    .digest("hex");

  return signature === data.signature;
};

const processMoMoResult = async (data) => {
  const order = await orderModel.findOne({ orderCode: data.orderId });
  if (!order) return { ok: false, code: "01", message: "Order not found" };

  const payment = await paymentModel.findOne({
    orderId: order._id,
    provider: "momo",
  });
  if (!payment) return { ok: false, code: "01", message: "Payment not found" };

  if (order.paymentStatus === "paid" || payment.status === "success") {
    return { ok: true, code: "02", message: "Already paid", order };
  }

  const paidAmount = Number(data.amount || 0);
  if (Math.abs(paidAmount - Number(order.total || 0)) > 1) {
    return { ok: false, code: "04", message: "Invalid amount" };
  }

  payment.transactionId = data.transId ? String(data.transId) : undefined;
  payment.gatewayResponse = data;

  if (Number(data.resultCode) === 0) {
    payment.status = "success";
    order.paymentStatus = "paid";
    order.orderStatus = "paid";
    order.transactionId = data.transId ? String(data.transId) : null;
    order.paidAt = new Date();

    await payment.save();
    await order.save();
    await finalizeReservedStock(order.items);
    await incDailyStats({
      date: order.paidAt,
      revenue: order.total,
      orders: 1,
    });
    await appendPurchaseHistoryAndSendMail(order);

    await createAndEmitNotification({
      type: "order_paid",
      title: "Order paid",
      message: `Order ${order.orderCode} has been paid`,
      data: {
        orderId: order._id,
        orderCode: order.orderCode,
        total: order.total,
      },
    });

    return { ok: true, code: "00", message: "Success", order };
  }

  payment.status = "failed";
  order.paymentStatus = "failed";
  order.orderStatus = "pending";

  await payment.save();
  await order.save();
  await releaseReservedStock(order.items);

  return {
    ok: true,
    code: "00",
    message: data.message || "Payment failed",
    order,
  };
};

export const createVNPayPayment = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await orderModel.findById(orderId);

    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.paymentStatus === "paid")
      return res.status(400).json({ message: "Order already paid" });

    if (order.orderStatus === "cancelled")
      return res.status(400).json({ message: "Order cancelled" });

    if (order.paymentStatus === "failed") {
      try {
        await reserveStock(order.items);
      } catch (err) {
        return res.status(400).json({
          message: err.message || "Unable to reserve stock for retry payment",
        });
      }
    }

    const payment = await upsertVNPayProcessing(order);
    const paymentUrl = createVNPayUrl(order, req, PAYMENT_EXPIRE_MINUTES);

    return res.json({
      paymentUrl,
      orderCode: order.orderCode,
      orderId: order._id,
      paymentId: payment._id,
      expiresAt: payment.expiresAt,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const vnpayIPN = async (req, res) => {
  try {
    const params = req.query;

    const isValid = verifyVNPayCallback(params);

    if (!isValid) {
      return res.json({ RspCode: "97", Message: "Invalid signature" });
    }

    const result = await processVNPayResult(params);
    return res.json({ RspCode: result.code, Message: result.message });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const vnpayReturn = (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:4201";

  const orderId = req.query.vnp_TxnRef;

  if (!orderId) {
    return res.redirect(`${frontendUrl}/payment/failed`);
  }

  return res.redirect(
    `${frontendUrl}/payment/processing?orderId=${encodeURIComponent(orderId)}`
  );
};

export const momoIPN = async (req, res) => {
  try {
    const data = req.body;

    if (!verifyMoMoSignature(data)) {
      return res.json({ RspCode: "97", message: "Invalid signature" });
    }

    const result = await processMoMoResult(data);
    return res.json({ RspCode: result.code, message: result.message });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const momoReturn = (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:4201";

  const redirect = async () => {
    const data = req.query;

    if (!verifyMoMoSignature(data)) {
      return res.redirect(
        `${frontendUrl}/payment/failed?reason=invalid-signature`
      );
    }

    const result = await processMoMoResult(data);
    const orderId = result.order?._id ? String(result.order._id) : "";
    return res.redirect(
      `${frontendUrl}/payment/processing?orderId=${encodeURIComponent(orderId)}`
    );
  };

  return redirect().catch(() =>
    res.redirect(`${frontendUrl}/payment/failed?reason=internal-error`)
  );
};

const extractSePayOrderCode = (payload = {}) => {
  const candidates = [
    payload?.content,
    payload?.description,
    payload?.transferContent,
    payload?.data?.content,
    payload?.data?.description,
    payload?.data?.transferContent,
  ];

  for (const value of candidates) {
    if (typeof value !== "string") continue;
    const matched = value.match(/ORD[-\s]?\d+(?:-\d+)?/i);
    if (matched?.[0]) return matched[0].toUpperCase();
  }

  return null;
};

const normalizeOrderCode = (value = "") =>
  String(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const extractSePayAmount = (payload = {}) => {
  const candidates = [
    payload?.amount,
    payload?.transferAmount,
    payload?.data?.amount,
    payload?.data?.transferAmount,
  ];

  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return 0;
};

const extractSePayTransactionId = (payload = {}) => {
  const candidates = [
    payload?.transactionId,
    payload?.id,
    payload?.transferId,
    payload?.code,
    payload?.data?.transactionId,
    payload?.data?.id,
    payload?.data?.transferId,
    payload?.data?.code,
  ];

  for (const value of candidates) {
    if (value === undefined || value === null) continue;
    const id = String(value).trim();
    if (id) return id;
  }

  return null;
};

export const sepayWebhook = async (req, res) => {
  try {
    const data = req.body;

    /**
     * SePay payload thường có:
     * {
     *   content: "ORD-xxx",
     *   amount: 120000,
     *   transactionId: "abc",
     *   signature: "..."
     * }
     */

    const orderCode = extractSePayOrderCode(data);
    if (!orderCode) {
      return res
        .status(400)
        .json({ message: "Order code not found in payload" });
    }

    let order = await orderModel.findOne({ orderCode });
    if (!order) {
      const normalizedIncomingCode = normalizeOrderCode(orderCode);
      const pendingOrders = await orderModel.find({
        paymentMethod: "sepay",
        orderStatus: "pending",
        paymentStatus: { $in: ["pending", "processing"] },
      });
      order =
        pendingOrders.find(
          (candidate) =>
            normalizeOrderCode(candidate.orderCode) === normalizedIncomingCode
        ) || null;
    }

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const payment = await paymentModel.findOne({
      orderId: order._id,
      provider: "sepay",
    });

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    if (order.paymentStatus === "paid") {
      return res.json({ message: "Already processed" });
    }

    // verify amount
    const paidAmount = extractSePayAmount(data);
    if (Math.abs(paidAmount - Number(order.total)) > 1) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    const transactionId = extractSePayTransactionId(data);

    payment.status = "success";
    payment.transactionId = transactionId || undefined;
    payment.gatewayResponse = data;

    order.paymentStatus = "paid";
    order.orderStatus = "paid";
    order.transactionId = transactionId;
    order.paidAt = new Date();

    await payment.save();
    await order.save();

    await finalizeReservedStock(order.items);
    await incDailyStats({
      date: order.paidAt,
      revenue: order.total,
      orders: 1,
    });
    console.log("hi1");
    await appendPurchaseHistoryAndSendMail(order);
    console.log("hi2");
    await createAndEmitNotification({
      type: "order_paid",
      title: "Order paid",
      message: `Order ${order.orderCode} has been paid`,
      data: {
        orderId: order._id,
        orderCode: order.orderCode,
        total: order.total,
      },
    });

    return res.json({ message: "OK" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
