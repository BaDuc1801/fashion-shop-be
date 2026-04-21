import notificationModel from "../../model/notification.model.js";
import axios from "axios";

export const createAndEmitNotification = async (payload) => {
  try {
    const notification = await notificationModel.create(payload);

    await axios.post(
      `${process.env.SOCKET_URL}/api/emit`,
      {
        event: "new_notification",
        room: "admins",
        data: notification,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.SECRET_KEY}`,
        },
      }
    );

    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};
