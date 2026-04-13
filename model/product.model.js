import mongoose from "mongoose";
import { calcStock } from "../utils/product.util.js";

const ColorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  quantity: { type: Number, default: 0 },
});

const SizeSchema = new mongoose.Schema({
  size: { type: String, required: true },
  colors: [ColorSchema],
});

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    sku: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    price: { type: Number, required: true },

    stock: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    images: [{ type: String }],

    sizeVariants: [SizeSchema],
  },
  { timestamps: true }
);

ProductSchema.pre("save", function () {
  if (this.sizeVariants?.length) {
    this.stock = calcStock(this.sizeVariants);
  }
});

ProductSchema.pre("findOneAndUpdate", function () {
  const update = this.getUpdate();

  if (update.sizeVariants) {
    update.stock = calcStock(update.sizeVariants);
  }
});

export default mongoose.model("product", ProductSchema);
