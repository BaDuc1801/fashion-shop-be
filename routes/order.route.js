import express from "express";
import orderController from "../controller/order.controller.js";
import userMiddleware from "../middleware/user.middleware.js";

const orderRouter = express.Router();

orderRouter.post("/", userMiddleware.verifyToken, orderController.createOrder);
orderRouter.get(
  "/my-orders",
  userMiddleware.verifyToken,
  orderController.getMyOrders
);
orderRouter.get(
  "/:id",
  userMiddleware.verifyToken,
  orderController.getOrderById
);
orderRouter.put(
  "/cancel/:id",
  userMiddleware.verifyToken,
  orderController.cancelOrder
);

export default orderRouter;
