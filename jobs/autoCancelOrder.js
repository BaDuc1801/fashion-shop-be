import cron from "node-cron";
import orderModel from "../model/order.model.js";

cron.schedule("* * * * *", async () => {
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const result = await orderModel.updateMany(
      {
        orderStatus: "pending",
        createdAt: { $lte: tenMinutesAgo },
      },
      {
        $set: {
          orderStatus: "cancelled",
          cancelReason: "Auto cancel after 10 minutes",
        },
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`Auto cancelled ${result.modifiedCount} orders`);
    }
  } catch (err) {
    console.error("Auto cancel error:", err);
  }
});
