import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import dashboardModel from "../model/dashboard.model.js";

dayjs.extend(utc);

export const incDailyStats = async ({
  date = new Date(),
  revenue = 0,
  orders = 0,
  cancelledOrders = 0,
  users = 0,
}) => {
  const day = dayjs(date).utc().startOf("day").toDate();

  await dashboardModel.updateOne(
    { date: day },
    {
      $inc: { revenue, orders, cancelledOrders, users },
    },
    { upsert: true }
  );
};
