import notificationModel from "../../model/notification.model.js";
import { getIO } from "../../socket/socket.js";

export const createAndEmitNotification = async (payload) => {
  try {
    const notification = await notificationModel.create(payload);

    const io = getIO();

    io.to("admins").emit("new_notification", notification);

    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};
