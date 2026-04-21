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
notificationRouter.get(
  "/customer",
  userMiddleware.verifyToken,
  notificationController.getMyNotifications
);
notificationRouter.get(
  "/customer/unread-count",
  userMiddleware.verifyToken,
  notificationController.getMyUnreadCount
);
notificationRouter.patch(
  "/customer/:id/read",
  userMiddleware.verifyToken,
  notificationController.markMyNotificationAsRead
);
notificationRouter.patch(
  "/customer/read-all",
  userMiddleware.verifyToken,
  notificationController.markAllMyNotificationsAsRead
);

export default notificationRouter;
