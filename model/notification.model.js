import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    type: String,
    title: {
      vi: String,
      en: String,
    },
    message: {
      vi: String,
      en: String,
    },
    data: Object,
    target: String,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
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
