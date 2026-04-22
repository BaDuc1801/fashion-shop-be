import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      minlength: 6,
    },

    avatar: {
      type: String,
      default: "",
    },

    phone: {
      type: String,
      unique: true,
      sparse: true,
    },

    otp: {
      code: { type: String },
      expiresAt: { type: Date },
      verified: { type: Boolean, default: false },
      purpose: {
        type: String,
        enum: ["verify_register", "reset_password"],
      },
    },

    refreshToken: {
      type: String,
      select: false,
    },

    address: { type: String },

    role: {
      type: String,
      enum: ["customer", "admin", "staff"],
      default: "customer",
    },

    provider: {
      type: String,
      enum: ["local", "google", "facebook"],
      default: "local",
    },

    providerId: {
      type: String,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    salary: {
      type: Number,
      default: 0,
    },

    wishlist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "product",
      },
    ],

    cart: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "product",
          required: true,
        },
        size: { type: String, required: true },
        color: { type: String, required: true },
        quantity: { type: Number, required: true },
      },
    ],

    purchaseHistory: [
      {
        orderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "order",
        },

        purchasedAt: {
          type: Date,
          required: true,
        },

        totalAmount: {
          type: Number,
          required: true,
        },

        status: {
          type: String,
          enum: [
            "completed",
            "cancelled",
            "shipping",
            "delivered",
            "pending",
            "paid",
          ],
          required: true,
        },

        items: [
          {
            productName: String,
            quantity: Number,
            unitPrice: Number,
            size: String,
            color: String,
          },
        ],
      },
    ],
  },
  { timestamps: true }
);

const userModel = mongoose.model("user", UserSchema);

export default userModel;
