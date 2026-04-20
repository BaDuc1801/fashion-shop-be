import notificationModel from "../model/notification.model.js";

const notificationController = {
  getNotifications: async (req, res) => {
    const userId = req.user.id;

    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const skip = (page - 1) * limit;

    const [list, total] = await Promise.all([
      notificationModel
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      notificationModel.countDocuments(),
    ]);

    const data = list.map((n) => {
      const isRead = n.readBy.some(
        (r) => String(r.userId) === String(userId)
      );

      return { ...n.toObject(), isRead };
    });

    return res.json({
      data,
      page,
      total,
      totalPages: Math.ceil(total / limit),
    });
  },

  // ✅ FIX UNREAD COUNT REALTIME SAFE
  getUnreadNotificationsCount: async (req, res) => {
    const userId = req.user.id;

    const total = await notificationModel.countDocuments({
      readBy: {
        $not: {
          $elemMatch: { userId },
        },
      },
    });

    return res.json({ total });
  },

  // ✅ FIX MARK READ
  markAsRead: async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    await notificationModel.updateOne(
      { _id: id },
      {
        $addToSet: {
          readBy: {
            userId,
            readAt: new Date(),
          },
        },
      }
    );

    return res.json({ success: true });
  },

  // ✅ FIX MARK ALL READ
  markAllAsRead: async (req, res) => {
    const userId = req.user.id;

    await notificationModel.updateMany(
      {
        readBy: {
          $not: {
            $elemMatch: { userId },
          },
        },
      },
      {
        $addToSet: {
          readBy: {
            userId,
            readAt: new Date(),
          },
        },
      }
    );

    return res.json({ success: true });
  },
};

export default notificationController;