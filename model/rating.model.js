import mongoose from "mongoose";

const ratingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "order",
      required: true,
      index: true,
    },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "product",
      required: true,
      index: true,
    },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    comment: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    images: [{ type: String }],

    // isPublic = true khi AI duyệt qua (thay cho isVisible trong review cũ)
    isPublic: {
      type: Boolean,
      default: false, 
      index: true,
    },

    moderation: {
      status: {
        type: String,
        enum: ["pending", "approved", "rejected", "need_review"],
        default: "pending",
      },
      reason: { type: String, default: "" }, 
      score:  { type: Number, default: 0 },   // 0.0 → 1.0
    },
  },
  { timestamps: true }
);

ratingSchema.index({ productId: 1, createdAt: -1 });
ratingSchema.index({ productId: 1, isPublic: 1 });

ratingSchema.statics.calcAverageRating = async function (productId) {
  const result = await this.aggregate([
    { $match: { productId: new mongoose.Types.ObjectId(productId), isPublic: true } },
    {
      $group: {
        _id: "$productId",
        avgRating: { $avg: "$rating" },
        totalRatings: { $sum: 1 },
      },
    },
  ]);

  return result[0] || { avgRating: 0, totalRatings: 0 };
};

export default mongoose.model("rating", ratingSchema);
