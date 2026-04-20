import express from "express";
import notificationController from "../controller/notification.controller.js";
import userMiddleware from "../middleware/user.middleware.js";

const notificationRouter = express.Router();

notificationRouter.get(
  "/",
  userMiddleware.verifyToken,
  notificationController.getNotifications
);

notificationRouter.get(
  "/unread",
  userMiddleware.verifyToken,
  notificationController.getUnreadNotificationsCount
);

notificationRouter.post(
  "/:id/read",
  userMiddleware.verifyToken,
  notificationController.markAsRead
);
notificationRouter.post(
  "/read-all",
  userMiddleware.verifyToken,
  notificationController.markAllAsRead
);

export default notificationRouter;
