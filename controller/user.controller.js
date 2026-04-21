import bcrypt from "bcryptjs";
import { generateOTP } from "../utils/otp.util.js";
import userModel from "../model/user.model.js";
import {
  clearAuthCookies,
  cookieBase,
  parseRefreshToken,
  REFRESH_COOKIE_MAX_AGE,
  sendInviteEmail,
  toPublicUser,
} from "../utils/user.util.js";
import { sendOtpEmail } from "../utils/user.util.js";
import { generateAccessToken } from "../utils/user.util.js";
import { issueRefreshToken } from "../utils/user.util.js";
import { setAuthCookies } from "../utils/user.util.js";
import { incDailyStats } from "../utils/dashboard.util.js";
import jwt from "jsonwebtoken";

const OTP_PURPOSES = {
  verify_register: {
    subject: "Verify Register — OTP",
    hint: "Enter the code below to verify your email.",
  },
  reset_password: {
    subject: "Reset Password — OTP",
    hint: "Use the code below to reset your password.",
  },
};

const setUserOtpByPurpose = (user, purpose) => {
  const otp = generateOTP();
  user.otp = {
    code: otp,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    verified: false,
    purpose,
  };
  return otp;
};

const userController = {
  // REGISTER
  register: async (req, res) => {
    try {
      const { body } = req;

      const hashedPassword = await bcrypt.hash(body.password, 10);
      const otp = generateOTP();

      const user = await userModel.create({
        name: body.name,
        email: body.email,
        password: hashedPassword,
        phone: body.phone,
        avatar:
          body.avatar ||
          "https://res.cloudinary.com/dzpw9bihb/image/upload/v1776063610/products/vynezdtx9rxrilgdrzas.jpg",
        isVerified: false,
        otp: {
          code: otp,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          purpose: "verify_register",
        },
      });

      await sendOtpEmail(
        body.email,
        "Verify Register — OTP",
        otp,
        "Enter the code below to verify your email."
      );

      await incDailyStats({
        date: new Date(),
        users: 1,
      });

      res.status(201).json({
        message:
          "Register successfully. OTP has been sent to your email — please verify.",
        user: toPublicUser(user),
        otpExpiresAt: user.otp?.expiresAt,
        serverTime: new Date(),
      });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({ message: "Email already exists" });
      }

      res.status(500).json({ message: err.message });
    }
  },

  // LOGIN
  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = await userModel.findOne({ email });

      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }

      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return res.status(400).json({ message: "Wrong password" });
      }

      const { access } = await setAuthCookies(res, user);

      res.json({
        user: toPublicUser(user),
        token: access,
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  // REFRESH
  refresh: async (req, res) => {
    try {
      const user = await parseRefreshToken(req.cookies.refresh_token);
      if (!user) {
        clearAuthCookies(res);
        return res
          .status(401)
          .json({ message: "Invalid or expired refresh token" });
      }

      const access = generateAccessToken(user);
      const refreshVal = await issueRefreshToken(user._id);

      res.cookie("access_token", access, {
        ...cookieBase(),
        maxAge: 30 * 60 * 1000,
      });
      res.cookie("refresh_token", refreshVal, {
        ...cookieBase(),
        maxAge: REFRESH_COOKIE_MAX_AGE,
      });

      res.json({ token: access });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  // GET PROFILE
  getProfile: async (req, res) => {
    try {
      const user = await userModel.findById(req.user.id).select("-password");

      res.json(user);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  // GET USERS
  getUsers: async (req, res) => {
    try {
      const { role, search, page = 1, limit = 10, sort = "newest" } = req.query;

      const query = {};

      if (role) {
        query.role = role;
      }

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
        ];
      }

      const skip = (Number(page) - 1) * Number(limit);

      let sortOption = { createdAt: -1 }; // newest default

      if (sort === "oldest") {
        sortOption = { createdAt: 1 };
      }

      const [users, total] = await Promise.all([
        userModel
          .find(query)
          .select("-password")
          .sort(sortOption)
          .skip(skip)
          .limit(Number(limit)),

        userModel.countDocuments(query),
      ]);

      res.json({
        data: users,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / limit),
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  // GET USER BY ID
  getUserById: async (req, res) => {
    try {
      const user = await userModel.findById(req.params.id).select("-password");
      res.json(user);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  // UPDATE USER
  updateUser: async (req, res) => {
    try {
      const { body } = req;

      if (!body.avatar) {
        body.avatar =
          "https://res.cloudinary.com/dzpw9bihb/image/upload/v1776063610/products/vynezdtx9rxrilgdrzas.jpg";
      }

      const user = await userModel
        .findByIdAndUpdate(req.params.id, body, {
          new: true,
          runValidators: true,
        })
        .select("-password");

      res.json(user);
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({ message: "Email already exists" });
      }

      res.status(500).json({ message: err.message });
    }
  },

  // CHANGE PASSWORD
  changePassword: async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body || {};

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          message: "currentPassword and newPassword are required",
        });
      }

      if (String(newPassword).length < 6) {
        return res
          .status(400)
          .json({ message: "Password must be at least 6 characters" });
      }

      const user = await userModel.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const ok = await bcrypt.compare(currentPassword, user.password);
      if (!ok) {
        return res
          .status(400)
          .json({ message: "Current password is incorrect" });
      }

      user.password = await bcrypt.hash(newPassword, 10);
      await user.save();

      await userModel.findByIdAndUpdate(user._id, {
        $unset: { refreshToken: 1 },
      });
      clearAuthCookies(res);

      res.json({ message: "Password changed — please login again" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  // DELETE USER
  deleteUser: async (req, res) => {
    try {
      await userModel.findByIdAndDelete(req.params.id);
      res.json({ message: "Deleted" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  // LOGOUT
  logout: async (req, res) => {
    try {
      const user = await parseRefreshToken(req.cookies.refresh_token);
      if (user) {
        await userModel.findByIdAndUpdate(user._id, {
          $unset: { refreshToken: 1 },
        });
      }
      clearAuthCookies(res);
      res.json({ message: "Logged out" });
    } catch (err) {
      clearAuthCookies(res);
      res.status(500).json({ message: err.message });
    }
  },

  // SEND OTP
  sendOTP: async (req, res) => {
    try {
      const { email } = req.body;

      const user = await userModel.findOne({ email });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const otp = setUserOtpByPurpose(user, "reset_password");

      await user.save();

      const otpMeta = OTP_PURPOSES.reset_password;
      await sendOtpEmail(email, otpMeta.subject, otp, otpMeta.hint);

      res.json({
        message: "OTP sent to email",
        otpExpiresAt: user.otp?.expiresAt,
        serverTime: new Date(),
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  // RESEND OTP
  resendOTP: async (req, res) => {
    try {
      const { email, purpose = "verify_register" } = req.body;

      if (!email) {
        return res.status(400).json({ message: "email is required" });
      }
      if (!OTP_PURPOSES[purpose]) {
        return res.status(400).json({
          message: "purpose must be verify_register or reset_password",
        });
      }

      const user = await userModel.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (purpose === "verify_register" && user.isVerified) {
        return res.status(400).json({ message: "User already verified" });
      }

      const otp = setUserOtpByPurpose(user, purpose);
      await user.save();

      const otpMeta = OTP_PURPOSES[purpose];
      await sendOtpEmail(email, otpMeta.subject, otp, otpMeta.hint);

      res.json({
        message: "OTP re-sent to email",
        purpose,
        otpExpiresAt: user.otp?.expiresAt,
        serverTime: new Date(),
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  // VERIFY OTP
  verifyOTP: async (req, res) => {
    try {
      const { email, otp } = req.body;

      const user = await userModel.findOne({ email });

      if (!user || !user.otp) {
        return res.status(400).json({ message: "Invalid OTP" });
      }

      if (user.otp.code !== otp) {
        return res.status(400).json({ message: "Wrong OTP" });
      }

      if (user.otp.expiresAt < new Date()) {
        return res.status(400).json({ message: "OTP expired" });
      }

      if (user.otp.purpose === "reset_password") {
        user.otp.verified = true;
        await user.save();
        return res.json({
          message: "OTP verified",
        });
      }

      user.isVerified = true;
      user.otp = undefined;
      await user.save();
      res.json({ message: "Verified success" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  // RESET PASSWORD
  resetPassword: async (req, res) => {
    try {
      const { email, newPassword } = req.body;

      if (!email || !newPassword) {
        return res
          .status(400)
          .json({ message: "email and newPassword are required" });
      }

      if (String(newPassword).length < 6) {
        return res
          .status(400)
          .json({ message: "Password must be at least 6 characters" });
      }

      const user = await userModel.findOne({ email });

      if (!user || !user.otp || user.otp.purpose !== "reset_password") {
        return res.status(400).json({ message: "Reset OTP not found" });
      }

      if (user.otp.expiresAt < new Date()) {
        return res.status(400).json({ message: "OTP expired" });
      }

      if (!user.otp.verified) {
        return res.status(400).json({
          message:
            "OTP is not verified. Please verify OTP first before resetting password.",
        });
      }

      user.password = await bcrypt.hash(newPassword, 10);
      user.otp = undefined;
      await user.save();

      await userModel.findByIdAndUpdate(user._id, {
        $unset: { refreshToken: 1 },
      });
      clearAuthCookies(res);

      res.json({ message: "Password updated — please login again" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  //Invite User
  inviteUser: async (req, res) => {
    try {
      const {
        name,
        email,
        role = "staff",
        phone,
        salary,
        joinDate,
        avatar,
        status,
      } = req.body;

      if (!name || !email) {
        return res.status(400).json({
          message: "name and email are required",
        });
      }

      if (!["staff", "admin"].includes(role)) {
        return res.status(400).json({
          message: "role must be staff or admin",
        });
      }

      const existed = await userModel.findOne({ email });
      if (existed) {
        return res.status(400).json({
          message: "Email already exists",
        });
      }

      const defaultPassword = "123456";
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);

      const user = await userModel.create({
        name,
        email,
        password: hashedPassword,
        role,
        provider: "local",
        isVerified: true,
        status,
        phone,
        salary,
        joinDate,
        avatar,
      });

      const subject = `Invitation to join Fashion Store as ${role.toUpperCase()}`;

      const html = `
        <h2>Hello ${name},</h2>
  
        <p>You have been invited to join <b>Fashion Store</b> as <b>${role.toUpperCase()}</b>.</p>
  
        <h3>Your login credentials:</h3>
        <p><b>Email:</b> ${email}</p>
        <p><b>Password:</b> 123456</p>
  
        <p>
          Please login here:<br/>
          <a href="https://fashion-shop-admin-topaz.vercel.app/">
            https://fashion-shop-admin-topaz.vercel.app/
          </a>
        </p>
  
        <p style="color:red;">
          After logging in, please change your password for security reasons.
        </p>
  
        <br/>
        <p>Welcome aboard 🚀</p>
      `;

      await sendOtpEmail(email, subject, "INVITE", html);

      return res.status(201).json({
        message: "User invited successfully",
        user: toPublicUser(user),
      });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  },

  addToWishlist: async (req, res) => {
    try {
      const { productId } = req.body;

      if (!productId) {
        return res.status(400).json({
          message: "productId is required",
        });
      }

      await userModel.findByIdAndUpdate(req.user.id, {
        $addToSet: { wishlist: productId },
      });

      res.json({ message: "Added to wishlist" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  removeFromWishlist: async (req, res) => {
    try {
      const { productId } = req.params;

      await userModel.findByIdAndUpdate(req.user.id, {
        $pull: { wishlist: productId },
      });

      res.json({ message: "Removed from wishlist" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  addToCart: async (req, res) => {
    try {
      const { productId, size, color, quantity = 1 } = req.body;

      if (!productId || !size || !color) {
        return res.status(400).json({
          message: "productId, size, color are required",
        });
      }

      const user = await userModel.findById(req.user.id);

      const existing = user.cart.find(
        (item) =>
          item.product.toString() === productId &&
          item.size === size &&
          item.color === color
      );

      if (existing) {
        existing.quantity += quantity;
      } else {
        user.cart.push({ product: productId, size, color, quantity });
      }

      await user.save();

      res.json({
        message: "Cart updated",
        cart: user.cart,
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  updateCartItem: async (req, res) => {
    try {
      const { productId, size, color, quantity } = req.body;

      if (!productId || !size || !color || quantity == null) {
        return res.status(400).json({
          message: "productId, size, color, quantity are required",
        });
      }

      const user = await userModel.findById(req.user.id);

      const item = user.cart.find(
        (i) =>
          i.product.toString() === productId &&
          i.size === size &&
          i.color === color
      );

      if (!item) {
        return res.status(404).json({ message: "Item not found in cart" });
      }

      if (quantity <= 0) {
        user.cart = user.cart.filter(
          (i) =>
            !(
              i.product.toString() === productId &&
              i.size === size &&
              i.color === color
            )
        );
      } else {
        item.quantity = quantity;
      }

      await user.save();

      res.json({
        message: "Cart updated",
        cart: user.cart,
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  removeFromCart: async (req, res) => {
    try {
      const { size, color } = req.body;
      const { productId } = req.params;

      const user = await userModel.findById(req.user.id);

      user.cart = user.cart.filter(
        (item) =>
          !(
            item.product.toString() === productId &&
            item.size === size &&
            item.color === color
          )
      );

      await user.save();

      res.json({
        message: "Removed from cart",
        cart: user.cart,
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  getWishlist: async (req, res) => {
    try {
      const user = await userModel.findById(req.user.id).populate("wishlist");
      res.json(user.wishlist);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  getCart: async (req, res) => {
    try {
      const user = await userModel.findById(req.user.id).populate({
        path: "cart.product",
        select: "name price images sku",
      });

      res.json(user.cart);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  googleCallback: async (req, res) => {
    try {
      const profile = req.user;

      if (!profile?.email) {
        return res.status(400).json({ message: "Google email missing" });
      }

      let user = await userModel.findOne({ email: profile.email });

      if (!user) {
        user = await userModel.create({
          name: profile.name,
          email: profile.email,
          avatar: profile.avatar || "",
          provider: "google",
          providerId: profile.id,
          isVerified: true,
          status: "active",
          role: "customer",
        });
      }

      const token = jwt.sign({ id: user._id }, process.env.SECRET_KEY, {
        expiresIn: "7d",
      });

      return res.redirect(
        `${process.env.FRONTEND_URL}/login-success?token=${token}`
      );
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  },
};

export default userController;
