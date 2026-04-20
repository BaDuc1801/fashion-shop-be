import { vnpConfig } from "../../config/vnpay.js";
import {
  buildQueryString,
  createVNPaySignature,
  getClientIp,
  verifyVNPaySignature,
} from "../../utils/payment.util.js";

/**
 * VNPay date format: yyyyMMddHHmmss
 */
export const formatVNPayDate = (date = new Date()) => {
  // VNPay expects GMT+7 timestamps in yyyyMMddHHmmss format
  const vnTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const yyyy = vnTime.getUTCFullYear();
  const MM = String(vnTime.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(vnTime.getUTCDate()).padStart(2, "0");
  const HH = String(vnTime.getUTCHours()).padStart(2, "0");
  const mm = String(vnTime.getUTCMinutes()).padStart(2, "0");
  const ss = String(vnTime.getUTCSeconds()).padStart(2, "0");

  return `${yyyy}${MM}${dd}${HH}${mm}${ss}`;
};

export const mapVNPayResponseMessage = (responseCode = "") => {
  const codeMap = {
    "00": "Giao dịch thành công",
    "07": "Trừ tiền thành công, giao dịch bị nghi ngờ",
    "09": "Thẻ/Tài khoản chưa đăng ký dịch vụ Internet Banking",
    "10": "Xác thực thông tin thẻ/tài khoản không đúng quá 3 lần",
    "11": "Hết hạn chờ thanh toán",
    "12": "Thẻ/Tài khoản bị khóa",
    "13": "Sai mật khẩu xác thực giao dịch",
    "24": "Khách hàng hủy giao dịch",
    "51": "Tài khoản không đủ số dư",
    "65": "Tài khoản vượt hạn mức giao dịch trong ngày",
    "75": "Ngân hàng thanh toán đang bảo trì",
    "79": "Sai mật khẩu thanh toán quá số lần quy định",
    "99": "Lỗi không xác định",
  };

  return codeMap[responseCode] || "Giao dịch không thành công";
};

/**
 * Create VNPay payment URL
 */
export const createVNPayUrl = (order, req, expiresInMinutes = 15) => {
  const date = new Date();
  const expireDate = new Date(date.getTime() + expiresInMinutes * 60 * 1000);

  const createDate = formatVNPayDate(date);
  const vnpExpireDate = formatVNPayDate(expireDate);

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
    vnp_ExpireDate: vnpExpireDate,
  };

  const secureHash = createVNPaySignature(params, vnpConfig.hashSecret);

  const query = buildQueryString({
    ...params,
    vnp_SecureHash: secureHash,
  });

  return `${vnpConfig.url}?${query}`;
};

/**
 * Verify callback params and signature
 */
export const verifyVNPayCallback = (params) => {
  if (!params?.vnp_TxnRef || !params?.vnp_ResponseCode || !params?.vnp_SecureHash) {
    return false;
  }

  return verifyVNPaySignature(params, vnpConfig.hashSecret);
};
