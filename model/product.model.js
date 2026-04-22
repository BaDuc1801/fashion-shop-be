import mongoose from "mongoose";
import { VariantSchema } from "./schemas/product.schema.js";

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    nameEn: { type: String, required: true },

    description: { type: String, required: true },
    descriptionEn: { type: String, required: true },

    sku: { type: String, required: true, unique: true, index: true },

    price: { type: Number, required: true },

    stock: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    variants: [VariantSchema],

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "category",
      required: true,
    },
  },
  { timestamps: true }
);

function calcStock(variants) {
  return variants.reduce(
    (total, v) => total + v.skus.reduce((sum, s) => sum + s.quantity, 0),
    0
  );
}

ProductSchema.pre("save", function () {
  if (this.variants) {
    this.stock = calcStock(this.variants);
  }
});

ProductSchema.pre("findOneAndUpdate", function () {
  const update = this.getUpdate();

  const variants = update.variants || update.$set?.variants;

  if (variants) {
    if (!update.$set) update.$set = {};
    update.$set.stock = calcStock(variants);
  }
});

export default mongoose.model("product", ProductSchema);
