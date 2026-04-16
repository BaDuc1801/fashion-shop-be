import express from "express";
import {
  createVNPayPayment,
  vnpayIPN,
  vnpayReturn,
} from "../controller/payment.controller.js";

const router = express.Router();

router.post("/vnpay/create", createVNPayPayment);
router.get("/vnpay-return", vnpayReturn);
router.get("/vnpay/return", vnpayReturn);
router.all("/vnpay/ipn", vnpayIPN);

export default router;
