import crypto from "crypto";
import { vnpConfig } from "../../config/vnpay.js";
import {
  buildQueryString,
  createVNPaySignature,
  getClientIp,
  sortObject,
} from "../../utils/payment.util.js";

/**
 * Create VNPay payment URL
 */
export const createVNPayUrl = (order, req) => {
  const date = new Date();

  const createDate = date
    .toISOString()
    .replace(/[-T:.Z]/g, "")
    .slice(0, 14);

  const params = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: vnpConfig.tmnCode,
    vnp_Locale: "vn",
    vnp_CurrCode: "VND",

    vnp_TxnRef: order.orderCode,
    vnp_OrderInfo: `Payment order ${order.orderCode}`,
    vnp_OrderType: "other",

    vnp_Amount: Math.round(Number(order.total || 0)) * 100,

    vnp_ReturnUrl: vnpConfig.returnUrl,
    vnp_IpAddr: getClientIp(req),

    vnp_CreateDate: createDate,
  };

  const secureHash = createVNPaySignature(params, vnpConfig.hashSecret);

  const query = buildQueryString({
    ...params,
    vnp_SecureHash: secureHash,
  });

  return `${vnpConfig.url}?${query}`;
};

/**
 * Verify IPN signature
 */
export const verifyVNPayIPN = (params) => {
  return (
    createVNPaySignature(
      Object.fromEntries(
        Object.entries(params).filter(
          ([k]) => k !== "vnp_SecureHash" && k !== "vnp_SecureHashType"
        )
      ),
      vnpConfig.hashSecret
    ) === params.vnp_SecureHash
  );
};
