import notificationModel from "../model/notification.model.js";
import { getIO } from "../socket/socket.js";

const notificationController = {
  getNotifications: async (req, res) => {
    const userId = req.user.id;

    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const skip = (page - 1) * limit;

    const [list, total] = await Promise.all([
      notificationModel.find().sort({ createdAt: -1 }).skip(skip).limit(limit),

      notificationModel.countDocuments(),
    ]);

    const data = list.map((n) => {
      const isRead = n.readBy.some((r) => String(r.userId) === String(userId));

      return { ...n.toObject(), isRead };
    });

    res.json({
      data,
      page,
      total,
      totalPages: Math.ceil(total / limit),
    });
  },

  getUnreadNotificationsCount: async (req, res) => {
    const userId = req.user.id;

    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const skip = (page - 1) * limit;

    const filter = {
      "readBy.userId": { $ne: userId },
    };

    const [list, total] = await Promise.all([
      notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      notificationModel.countDocuments(filter),
    ]);

    const data = list.map((n) => ({
      ...n.toObject(),
      isRead: false,
    }));

    res.json({
      total,
    });
  },

  markAsRead: async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    await notificationModel.updateOne(
      { _id: id, "readBy.userId": { $ne: userId } },
      {
        $push: {
          readBy: {
            userId,
            readAt: new Date(),
          },
        },
      }
    );

    const io = getIO();

    io.to(`admin_${userId}`).emit("notification_read", { id });

    res.json({ success: true });
  },

  markAllAsRead: async (req, res) => {
    const userId = req.user.id;

    const notis = await notificationModel
      .find({
        "readBy.userId": { $ne: userId },
      })
      .select("_id");

    const bulk = notis.map((n) => ({
      updateOne: {
        filter: { _id: n._id },
        update: {
          $push: {
            readBy: {
              userId,
              readAt: new Date(),
            },
          },
        },
      },
    }));

    if (bulk.length) {
      await notificationModel.bulkWrite(bulk);
    }

    const io = getIO();
    io.to(`admin_${userId}`).emit("notification_read_all");

    res.json({ success: true });
  },
};

export default notificationController;
