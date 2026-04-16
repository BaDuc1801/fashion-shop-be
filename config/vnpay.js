export const vnpConfig = {
  tmnCode: process.env.VNP_TMNCODE,
  hashSecret: process.env.VNP_HASH_SECRET,
  url: process.env.VNP_URL,
  returnUrl: process.env.VNP_RETURN_URL
    ? process.env.VNP_RETURN_URL
    : process.env.NODE_ENV === "production"
      ? `${process.env.APP_URL}/api/payments/vnpay-return`
      : "http://localhost:8080/api/payments/vnpay-return",
  ipnUrl:
    process.env.NODE_ENV === "production"
      ? `${process.env.APP_URL}/api/payments/vnpay/ipn`
      : "http://localhost:8080/api/payments/vnpay/ipn",
};
