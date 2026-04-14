import express from "express";
import voucherController from "../controller/voucher.controller.js";

const voucherRouter = express.Router();

voucherRouter.post("/", voucherController.createVoucher);
voucherRouter.get("/", voucherController.getVouchers);
voucherRouter.get("/:id", voucherController.getVoucherById);
voucherRouter.put("/:id", voucherController.updateVoucher);
voucherRouter.delete("/:id", voucherController.deleteVoucher);

export default voucherRouter;
