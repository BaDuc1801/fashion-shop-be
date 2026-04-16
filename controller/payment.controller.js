import orderModel from "../model/order.model.js";
import {
  createVNPayUrl,
  verifyVNPayIPN,
} from "../services/payment/vnpay.service.js";

/**
 * CREATE PAYMENT URL
 */
export const createVNPayPayment = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await orderModel.findById(orderId);

    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.paymentStatus === "paid")
      return res.status(400).json({ message: "Order already paid" });

    if (order.orderStatus === "cancelled")
      return res.status(400).json({ message: "Order cancelled" });

    const paymentUrl = createVNPayUrl(order, req);

    return res.json({
      paymentUrl,
      orderCode: order.orderCode,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/**
 * IPN (WEBHOOK FROM VNPay)
 */
export const vnpayIPN = async (req, res) => {
  try {
    const params = req.query;

    const isValid = verifyVNPayIPN(params);

    if (!isValid) {
      return res.json({ RspCode: "97", Message: "Invalid signature" });
    }

    const order = await orderModel.findOne({
      orderCode: params.vnp_TxnRef,
    });

    if (!order) {
      return res.json({ RspCode: "01", Message: "Order not found" });
    }

    // idempotency
    if (order.paymentStatus === "paid") {
      return res.json({ RspCode: "02", Message: "Already paid" });
    }

    const isSuccess =
      params.vnp_ResponseCode === "00" && params.vnp_TransactionStatus === "00";

    if (isSuccess) {
      order.paymentStatus = "paid";
      order.orderStatus = "confirmed";
      order.transactionId = params.vnp_TransactionNo;

      await order.save();

      return res.json({ RspCode: "00", Message: "Success" });
    }

    order.paymentStatus = "failed";
    await order.save();

    return res.json({ RspCode: "00", Message: "Failed" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/**
 * RETURN URL (FRONTEND REDIRECT ONLY)
 */
export const vnpayReturn = (req, res) => {
  const { vnp_ResponseCode } = req.query;

  if (vnp_ResponseCode === "00") {
    return res.redirect("http://localhost:3000/payment/success");
  }

  return res.redirect("http://localhost:3000/payment/failed");
};
