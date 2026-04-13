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
      purpose: {
        type: String,
        enum: ["verify_register", "reset_password"],
      },
    },

    refreshToken: {
      type: String,
      select: false,
    },

    addresses: [{ type: String }],

    role: {
      type: String,
      enum: ["customer", "admin", "staff"],
      default: "customer",
    },

    provider: {
      type: String,
      enum: ["local", "google"],
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
      enum: ["active", "blocked"],
      default: "active",
    },
  },
  { timestamps: true }
);

const userModel = mongoose.model("user", UserSchema);

export default userModel;
