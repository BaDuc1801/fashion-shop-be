import mongoose from "mongoose";

const VoucherSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    image: {
      type: String,
      default: "",
    },

    discountPercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },

    maxDiscount: {
      type: Number,
      required: true,
    },

    minOrderValue: {
      type: Number,
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    maxUsage: {
      type: Number,
      default: null, // null = unlimited
    },

    usedCount: {
      type: Number,
      default: 0,
    },

    usedBy: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "user",
        },
        orderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "order",
        },
        usedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

const voucherModel = mongoose.model("voucher", VoucherSchema);
export default voucherModel;
