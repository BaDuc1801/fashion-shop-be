import "dotenv/config";

import mongoose from "mongoose";
import cors from "cors";
import express from "express";
import cookieParser from "cookie-parser";
import productRouter from "./routes/product.route.js";
import uploadRouter from "./routes/upload.route.js";
import userRouter from "./routes/user.route.js";
import categoryRouter from "./routes/category.route.js";
import voucherRouter from "./routes/voucher.route.js";
import orderRouter from "./routes/order.route.js";
import paymentRouter from "./routes/payment.route.js";
import ratingRouter from "./routes/rating.route.js";
import dashboardRouter from "./routes/dashboard.route.js";
import notificationRouter from "./routes/notification.route.js";
import passport from "passport";
import "./config/passport.js";
import userController from "./controller/user.controller.js";

const mongoUri = process.env.MONGOCONNECT;
if (!mongoUri) {
  throw new Error("Missing MONGOCONNECT");
}
if (mongoose.connection.readyState !== 1) {
  await mongoose.connect(mongoUri);
}

const corsOptions = {
  origin: [
    "https://fashion-shop-tau-three.vercel.app",
    "https://fashion-shop-admin-topaz.vercel.app",
    "http://localhost:4200",
    "http://localhost:4201",
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  credentials: true,
};

const app = express();

app.use(passport.initialize());
app.use(express.json());
app.use(cors(corsOptions));
app.use(cookieParser());

app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { session: false }),
  userController.googleCallback
);

app.get("/", (req, res) => {
  res.status(200).json({ message: "hello!" });
});
app.use("/api/upload", uploadRouter);
app.use("/api/products", productRouter);
app.use("/api/users", userRouter);
app.use("/api/categories", categoryRouter);
app.use("/api/vouchers", voucherRouter);
app.use("/api/orders", orderRouter);
app.use("/api/payments", paymentRouter);
app.use("/api/ratings", ratingRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/notifications", notificationRouter);

if (!process.env.VERCEL) {
  app.listen(8080, () => {
    console.log("Server is running");
  });
}

export default app;
