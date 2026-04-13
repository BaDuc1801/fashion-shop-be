import "dotenv/config";

import mongoose from "mongoose";
import cors from "cors";
import express from "express";
import cookieParser from "cookie-parser";
import productRouter from "./routes/product.route.js";
import uploadRouter from "./routes/upload.route.js";

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
    "http://localhost:4000",
    "http://localhost:4001",
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
};

const app = express();
app.use(express.json());
app.use(cors(corsOptions));
app.use(cookieParser());

app.get("/", (req, res) => {
  res.status(200).json({ message: "hello!" });
});
app.use("/api/upload", uploadRouter);
app.use("/api/products", productRouter);

if (!process.env.VERCEL) {
  app.listen(8080, () => {
    console.log("Server is running");
  });
}

export default app;
