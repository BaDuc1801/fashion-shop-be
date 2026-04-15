import mongoose from "mongoose";
import { calcStock } from "../utils/product.util.js";
import { SizeSchema } from "./schemas/product.schema.js";

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    description: { type: String, required: true },

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

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "category",
      required: true,
      index: true,
    },
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

const productModel = mongoose.model("product", ProductSchema);

export default productModel;
