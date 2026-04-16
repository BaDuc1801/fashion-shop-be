import crypto from "crypto";

export const sortObject = (obj) => {
  const sorted = {};
  Object.keys(obj)
    .sort()
    .forEach((key) => {
      sorted[key] = obj[key];
    });
  return sorted;
};

export const vnpEncode = (value) => {
  return encodeURIComponent(String(value))
    .replace(/%20/g, "+")
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16)}`);
};

export const buildQueryString = (params) => {
  return Object.keys(params)
    .sort()
    .map((key) => {
      const value = params[key];
      if (value === undefined || value === null || value === "") return null;

      return `${vnpEncode(key)}=${vnpEncode(value)}`;
    })
    .filter(Boolean)
    .join("&");
};

export const createVNPaySignature = (params, secret) => {
  const sorted = sortObject(params);
  const query = buildQueryString(sorted);

  return crypto
    .createHmac("sha512", secret)
    .update(query, "utf-8")
    .digest("hex");
};

export const verifyVNPaySignature = (params, secret) => {
  const { vnp_SecureHash, vnp_SecureHashType, ...rest } = params;

  const sign = createVNPaySignature(rest, secret);

  return sign === vnp_SecureHash;
};

export const getClientIp = (req) => {
  const rawIp =
    req?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req?.socket?.remoteAddress ||
    req?.ip ||
    "127.0.0.1";

  return rawIp === "::1" ? "127.0.0.1" : rawIp.replace("::ffff:", "");
};
