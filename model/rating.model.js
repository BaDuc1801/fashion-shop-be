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

    images: [
      {
        type: String,
      },
    ],

    isPublic: {
      type: Boolean,
      default: true,
      index: true,
    },

    isToxic: {
      type: Boolean,
      default: false,
      index: true,
    },

    toxicityReason: {
      type: String,
      default: "",
    },

    toxicityReasonEn: {
      type: String,
      default: "",
    },

    maskedComment: {
      type: String,
      default: "",
    },

    maskedRanges: {
      type: [[Number, Number]],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

ratingSchema.index({ productId: 1, createdAt: -1 });

ratingSchema.statics.calcAverageRating = async function (productId) {
  const result = await this.aggregate([
    {
      $match: {
        productId: new mongoose.Types.ObjectId(productId),
        isPublic: true,
      },
    },
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
