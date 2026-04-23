import express from "express";
import shippingController from "../controller/shipping.controller.js";

const shippingRouter = express.Router();

shippingRouter.post("/calculate", shippingController.calculateShippingFee);

export default shippingRouter;
