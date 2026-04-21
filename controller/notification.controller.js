import notificationModel from "../model/notification.model.js";

const notificationController = {
  getNotifications: async (req, res) => {
    const userId = req.user.id;

    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const skip = (page - 1) * limit;

    const [list, total] = await Promise.all([
      notificationModel
        .find({ target: "admin" })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      notificationModel.countDocuments({ target: "admin" }),
    ]);

    const data = list.map((n) => {
      const isRead = n.readBy.some((r) => String(r.userId) === String(userId));

      return { ...n.toObject(), isRead };
    });

    return res.json({
      data,
      page,
      total,
      totalPages: Math.ceil(total / limit),
    });
  },

  getUnreadNotificationsCount: async (req, res) => {
    const userId = req.user.id;

    const total = await notificationModel.countDocuments({
      target: "admin",
      readBy: {
        $not: {
          $elemMatch: { userId },
        },
      },
    });

    return res.json({ total });
  },

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

  getMyNotifications: async (req, res) => {
    try {
      const userId = req.user.id;

      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 10);
      const skip = (page - 1) * limit;

      const [list, total] = await Promise.all([
        notificationModel
          .find({ userId, target: "customer" })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),

        notificationModel.countDocuments({ userId, target: "customer" }),
      ]);

      const data = list.map((n) => {
        console.log(n.readBy);
        const isRead = n.readBy.some((r) => r.userId?.equals?.(userId));

        return { ...n.toObject(), isRead };
      });

      return res.json({
        data,
        page,
        total,
        totalPages: Math.ceil(total / limit),
      });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  },

  getMyUnreadCount: async (req, res) => {
    try {
      const userId = req.user.id;

      const total = await notificationModel.countDocuments({
        userId,
        target: "customer",
        readBy: {
          $not: {
            $elemMatch: { userId },
          },
        },
      });

      return res.json({ total });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  },

  markMyNotificationAsRead: async (req, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      await notificationModel.updateOne(
        {
          _id: id,
          userId,
          target: "customer",
          "readBy.userId": { $ne: userId },
        },
        {
          $push: {
            readBy: {
              userId,
              readAt: new Date(),
            },
          },
        }
      );

      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  },

  markAllMyNotificationsAsRead: async (req, res) => {
    try {
      const userId = req.user.id;

      await notificationModel.updateMany(
        {
          userId,
          target: "customer",
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
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  },
};

export default notificationController;
