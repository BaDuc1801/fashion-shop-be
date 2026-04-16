import express from "express";
import {
  createVNPayPayment,
  momoIPN,
  momoReturn,
  sepayWebhook,
  vnpayIPN,
  vnpayReturn,
} from "../controller/payment.controller.js";

const router = express.Router();

router.post("/vnpay/create", createVNPayPayment);
router.get("/vnpay-return", vnpayReturn);
router.get("/vnpay/return", vnpayReturn);
router.all("/vnpay/ipn", vnpayIPN);
router.all("/momo/ipn", momoIPN);
router.get("/momo/return", momoReturn);
router.post("/sepay/webhook", sepayWebhook);

export default router;
