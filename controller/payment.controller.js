import orderModel from "../model/order.model.js";
import paymentModel from "../model/payment.model.js";
import mongoose from "mongoose";
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

const PAYMENT_EXPIRE_MINUTES = 15;

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
    order.orderStatus = "confirmed";
    order.transactionId = params.vnp_TransactionNo;
    order.paidAt = new Date();

    await payment.save();
    await order.save();
    await finalizeReservedStock(order.items);

    await userModel.updateOne(
      { _id: order.userId },
      {
        $push: {
          purchaseHistory: {
            orderId: order._id,
            purchasedAt: order.paidAt || new Date(),
            totalAmount: order.total,

            status:
              order.orderStatus === "confirmed" ? "completed" : "shipping",

            items: order.items.map((i) => ({
              productName: i.nameSnapshot,
              quantity: i.quantity,
              unitPrice: i.price,
            })),
          },
        },
      }
    );

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
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  const redirect = async () => {
    const params = req.query;
    const isValid = verifyVNPayCallback(params);

    if (!isValid) {
      return res.redirect(
        `${frontendUrl}/payment/failed?reason=invalid-signature`
      );
    }

    const result = await processVNPayResult(params);
    const status =
      result.responseCode === "00" || result.code === "02"
        ? "success"
        : "failed";

    const query =
      `status=${encodeURIComponent(status)}` +
      `&orderCode=${encodeURIComponent(params.vnp_TxnRef || "")}` +
      `&txn=${encodeURIComponent(params.vnp_TransactionNo || "")}` +
      `&message=${encodeURIComponent(result.message)}`;

    return res.redirect(`${frontendUrl}/payment/result?${query}`);
  };

  return redirect().catch(() =>
    res.redirect(`${frontendUrl}/payment/failed?reason=internal-error`)
  );
};
