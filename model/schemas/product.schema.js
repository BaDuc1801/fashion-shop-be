import mongoose from "mongoose";

export const SkuSchema = new mongoose.Schema({
  size: { type: String, required: true },
  quantity: { type: Number, default: 0 },
  reserved: { type: Number, default: 0 },
  sold: { type: Number, default: 0 },
});

export const VariantSchema = new mongoose.Schema({
  color: { type: String, required: true },
  images: [{ type: String }],
  skus: [SkuSchema],
});
