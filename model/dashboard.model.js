import mongoose from "mongoose";

const dashboardSchema = new mongoose.Schema({
  date: { type: Date, required: true, unique: true },
  revenue: { type: Number, default: 0 },
  orders: { type: Number, default: 0 },
  canceledOrders: { type: Number, default: 0 },
  customers: { type: Number, default: 0 },
});

const dashboardModel = mongoose.model("dashboard", dashboardSchema);

export default dashboardModel;