import mongoose from "mongoose";

export const ColorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  quantity: { type: Number, default: 0 },
  reserved: { type: Number, default: 0 },
  sold: { type: Number, default: 0 },
});

export const SizeSchema = new mongoose.Schema({
  size: { type: String, required: true },
  colors: [ColorSchema],
});
