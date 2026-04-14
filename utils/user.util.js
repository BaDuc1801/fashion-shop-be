import crypto from "crypto";
import jwt from "jsonwebtoken";
import transporter from "../config/mailer.js";
import bcrypt from "bcryptjs";
import userModel from "../model/user.model.js";

const ACCESS_EXPIRES = "15m";
export const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

export const cookieBase = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  path: "/",
});

export const generateAccessToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.SECRET_KEY, {
    expiresIn: ACCESS_EXPIRES,
  });
};

export const issueRefreshToken = async (userId) => {
  const secret = crypto.randomBytes(48).toString("hex");
  const hash = await bcrypt.hash(secret, 10);
  await userModel.findByIdAndUpdate(userId, { refreshToken: hash });
  return `${userId.toString()}.${secret}`;
};

export const parseRefreshToken = async (cookieVal) => {
  if (!cookieVal || typeof cookieVal !== "string") return null;
  const dot = cookieVal.indexOf(".");
  if (dot === -1) return null;
  const userId = cookieVal.slice(0, dot);
  const secret = cookieVal.slice(dot + 1);
  if (!userId || !secret) return null;
  const user = await userModel.findById(userId).select("+refreshToken");
  if (!user?.refreshToken) return null;
  const ok = await bcrypt.compare(secret, user.refreshToken);
  return ok ? user : null;
};

export const setAuthCookies = async (res, user) => {
  const access = generateAccessToken(user);
  const refreshVal = await issueRefreshToken(user._id);
  res.cookie("access_token", access, {
    ...cookieBase(),
    maxAge: 15 * 60 * 1000,
  });
  res.cookie("refresh_token", refreshVal, {
    ...cookieBase(),
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
  return { access, refreshVal };
};

export const clearAuthCookies = (res) => {
  res.clearCookie("access_token", { path: "/" });
  res.clearCookie("refresh_token", { path: "/" });
};

export const toPublicUser = (user) => {
  const o = user.toObject ? user.toObject() : { ...user };
  delete o.otp;
  delete o.password;
  delete o.refreshToken;
  return o;
};

export const sendOtpEmail = async (to, subject, otp, hint) => {
  await transporter.sendMail({
    from: `"fashion-shop" <${process.env.MAIL_USER}>`,
    to,
    subject,
    html: `
      <h2>${hint}</h2>
      <p>Code OTP: <b>${otp}</b></p>
      <p>Expires in 5 minutes.</p>
    `,
  });
};

export const sendInviteEmail = async (to, subject, html) => {
  await transporter.sendMail({
    from: `"fashion-shop" <${process.env.MAIL_USER}>`,
    to,
    subject,
    html,
  });
};
