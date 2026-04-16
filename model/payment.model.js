import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "order",
      required: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },

    provider: {
      type: String,
      enum: ["vnpay", "momo", "cod", "sepay"],
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "processing", "success", "failed"],
      default: "pending",
      index: true,
    },

    transactionId: {
      type: String,
      index: true,
    },

    txnRef: {
      type: String,
      required: true,
      index: true,
    },

    // raw response from VNPay / Momo / SePay
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // timeout payment (VNPay/Momo)
    expiresAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

PaymentSchema.index({ orderId: 1, provider: 1 }, { unique: true });
PaymentSchema.index({ txnRef: 1, provider: 1 }, { unique: true });

const paymentModel = mongoose.model("payment", PaymentSchema);
export default paymentModel;
