import mongoose from "mongoose";

const OrderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "product",
      required: true,
      index: true,
    },

    nameSnapshot: {
      type: String,
      required: true,
    },

    imageSnapshot: {
      type: String,
      default: "",
    },

    size: String,
    color: String,

    price: {
      type: Number,
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    orderCode: {
      type: String,
      unique: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },

    items: [OrderItemSchema],

    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },

    shippingFee: {
      type: Number,
      default: 0,
    },

    discount: {
      voucherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "voucher",
      },
      discountAmount: {
        type: Number,
        default: 0,
      },
    },

    total: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "VND",
    },

    shippingAddress: {
      name: String,
      phone: String,
      address: String,
    },

    note: String,
    cancelReason: String,

    paymentMethod: {
      type: String,
      enum: ["vnpay", "momo", "cod", "sepay"],
      required: true,
      index: true,
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "processing", "paid", "failed", "refunded"],
      default: "pending",
      index: true,
    },

    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "payment",
    },

    transactionId: {
      type: String,
      default: null,
      index: true,
    },

    orderStatus: {
      type: String,
      enum: ["pending", "confirmed", "shipping", "delivered", "cancelled"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

OrderSchema.pre("save", function () {
  if (!this.orderCode) {
    this.orderCode = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }
});

const orderModel = mongoose.model("order", OrderSchema);
export default orderModel;
