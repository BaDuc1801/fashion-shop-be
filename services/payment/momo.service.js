import https from "https";
import crypto from "crypto";

const PARTNER_CODE = process.env.MOMO_PARTNER_CODE;
const ACCESS_KEY = process.env.MOMO_ACCESS_KEY;
const SECRET_KEY = process.env.MOMO_SECRET_KEY;

const ENDPOINT = process.env.MOMO_ENDPOINT || "test-payment.momo.vn";
const PATH = "/v2/gateway/api/create";

export const createMoMoUrl = (order, req, expireMinutes = 15) => {
  return new Promise((resolve, reject) => {
    const requestId = `${PARTNER_CODE}-${Date.now()}`;
    const orderId = order.orderCode;

    const amount = String(order.total);
    const orderInfo = `Pay order ${order.orderCode}`;

    const redirectUrl =
      process.env.MOMO_RETURN_URL ||
      `${req.protocol}://${req.get("host")}/api/payments/momo/return`;

    const ipnUrl = process.env.MOMO_IPN_URL || "http://localhost:8080/api/payments/momo/ipn";

    const requestType = "payWithMethod";
    const extraData = "";

    const rawSignature =
      `accessKey=${ACCESS_KEY}` +
      `&amount=${amount}` +
      `&extraData=${extraData}` +
      `&ipnUrl=${ipnUrl}` +
      `&orderId=${orderId}` +
      `&orderInfo=${orderInfo}` +
      `&partnerCode=${PARTNER_CODE}` +
      `&redirectUrl=${redirectUrl}` +
      `&requestId=${requestId}` +
      `&requestType=${requestType}`;

    const signature = crypto
      .createHmac("sha256", SECRET_KEY)
      .update(rawSignature)
      .digest("hex");

    const requestBody = JSON.stringify({
      partnerCode: PARTNER_CODE,
      accessKey: ACCESS_KEY,
      requestId,
      amount,
      orderId,
      orderInfo,
      redirectUrl,
      ipnUrl,
      extraData,
      requestType,
      signature,
      lang: "vi",
      autoCapture: true,
    });

    const options = {
      hostname: ENDPOINT,
      port: 443,
      path: PATH,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(requestBody),
      },
    };

    const momoReq = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      });
    });

    momoReq.on("error", (err) => reject(err));

    momoReq.write(requestBody);
    momoReq.end();
  });
};
