import mongoose from "mongoose";

const ReviewSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "product",  
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, required: true, trim: true },

    // Kết quả AI kiểm duyệt — tự động điền khi user submit review
    moderation: {
      status: {
        type: String,
        enum: ["pending", "approved", "rejected", "need_review"],
        default: "pending",
      },
      reason: { type: String, default: "" },   // lý do nếu bị từ chối
      score:  { type: Number, default: 0 },    // 0.0 → 1.0 (1.0 = hoàn toàn sạch)
    },

    // Chỉ hiển thị ra ngoài khi moderation.status = "approved"
    isVisible: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ReviewSchema.index({ productId: 1, isVisible: 1 });
ReviewSchema.index({ userId: 1 });

const reviewModel = mongoose.model("review", ReviewSchema);
export default reviewModel;
