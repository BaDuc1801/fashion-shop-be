import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    type: String,
    title: String,
    message: String,
    data: Object,

    readBy: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
        readAt: Date,
      },
    ],
  },
  { timestamps: true }
);

const notificationModel = mongoose.model("notification", notificationSchema);

export default notificationModel;
