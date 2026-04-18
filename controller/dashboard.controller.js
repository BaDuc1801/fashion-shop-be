import orderModel from "../model/order.model.js";
import userModel from "../model/user.model.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = "Asia/Ho_Chi_Minh";

/**
 * =========================
 * RANGE HELPER
 * =========================
 */
const getRange = (type, from, to) => {
  const now = dayjs().tz(TZ);

  switch (type) {
    case "day":
      return {
        from: now.startOf("day"),
        to: now.endOf("day"),
        groupFormat: "%Y-%m-%d",
      };

    case "week":
      return {
        from: now.subtract(6, "day").startOf("day"),
        to: now.endOf("day"),
        groupFormat: "%Y-%m-%d",
      };

    case "month":
      return {
        from: now.subtract(29, "day").startOf("day"),
        to: now.endOf("day"),
        groupFormat: "%Y-%m-%d",
      };

    case "3m":
      return {
        from: now.subtract(90, "day").startOf("day"),
        to: now.endOf("day"),
        groupFormat: "%Y-%m-%d",
      };

    case "6m":
      return {
        from: now.subtract(180, "day").startOf("day"),
        to: now.endOf("day"),
        groupFormat: "%Y-%m-%d",
      };

    case "year":
      return {
        from: now.subtract(11, "month").startOf("month"),
        to: now.endOf("month"),
        groupFormat: "%Y-%m",
      };

    case "custom":
      return {
        from: dayjs(from).tz(TZ).startOf("day"),
        to: dayjs(to).tz(TZ).endOf("day"),
        groupFormat: "%Y-%m-%d",
      };

    default:
      return {
        from: now.startOf("day"),
        to: now.endOf("day"),
        groupFormat: "%Y-%m-%d",
      };
  }
};

const calcPercent = (cur, prev) => {
  if (!prev) return cur > 0 ? 100 : 0;
  return +(((cur - prev) / prev) * 100).toFixed(2);
};

const dashboardController = {
  dashboardSummary: async (req, res) => {
    try {
      const type = req.query.range || "day";
      const now = dayjs().tz(TZ);

      const current = getRange(type);

      const diffMap = {
        day: 1,
        week: 7,
        month: 30,
        "3m": 90,
        "6m": 180,
        year: 365,
      };

      const diff = diffMap[type] || 1;

      const prev = {
        from: now.subtract(diff * 2, "day").startOf("day"),
        to: now.subtract(diff, "day").endOf("day"),
      };

      const [curOrders, prevOrders, curUsers, prevUsers] = await Promise.all([
        orderModel.find({
          createdAt: {
            $gte: current.from.toDate(),
            $lte: current.to.toDate(),
          },
        }),

        orderModel.find({
          createdAt: {
            $gte: prev.from.toDate(),
            $lte: prev.to.toDate(),
          },
        }),

        userModel.find({
          createdAt: {
            $gte: current.from.toDate(),
            $lte: current.to.toDate(),
          },
        }),

        userModel.find({
          createdAt: {
            $gte: prev.from.toDate(),
            $lte: prev.to.toDate(),
          },
        }),
      ]);

      const revenue = (list) =>
        list.reduce((sum, o) => sum + (o.total || 0), 0);

      const curRevenue = revenue(curOrders);
      const prevRevenue = revenue(prevOrders);

      const curCancelled = curOrders.filter(
        (o) => o.orderStatus === "cancelled"
      ).length;

      const prevCancelled = prevOrders.filter(
        (o) => o.orderStatus === "cancelled"
      ).length;

      return res.json({
        range: type,

        revenue: {
          current: curRevenue,
          previous: prevRevenue,
          change: calcPercent(curRevenue, prevRevenue),
        },

        orders: {
          current: curOrders.length,
          previous: prevOrders.length,
          change: calcPercent(curOrders.length, prevOrders.length),
        },

        cancelledOrders: {
          current: curCancelled,
          previous: prevCancelled,
          change: calcPercent(curCancelled, prevCancelled),
        },

        users: {
          current: curUsers.length,
          previous: prevUsers.length,
          change: calcPercent(curUsers.length, prevUsers.length),
        },
      });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  },

  dashboardChart: async (req, res) => {
    try {
      const { type = "week", from, to } = req.query;
      const range = getRange(type, from, to);

      const data = await orderModel.aggregate([
        {
          $match: {
            createdAt: {
              $gte: range.from.toDate(),
              $lte: range.to.toDate(),
            },
          },
        },
        {
          $project: {
            time: {
              $dateToString: {
                format: range.groupFormat,
                date: "$createdAt",
                timezone: TZ,
              },
            },
            revenue: "$total",
          },
        },
        {
          $group: {
            _id: "$time",
            revenue: { $sum: "$revenue" },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      return res.json({
        type,
        from: range.from,
        to: range.to,
        data,
      });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  },
};

export default dashboardController;