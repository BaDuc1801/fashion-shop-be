import productModel from "../../model/product.model.js";

const getColorVariant = (product, sizeName, colorName) => {
  const sizeVariant = product.sizeVariants.find((s) => s.size === sizeName);
  if (!sizeVariant) return null;

  return sizeVariant.colors.find((c) => c.name === colorName) || null;
};

export const reserveStock = async (items) => {
  for (const item of items) {
    const product = await productModel.findById(item.productId);

    if (!product) {
      throw new Error(`Product not found: ${item.productId}`);
    }

    const colorVariant = getColorVariant(product, item.size, item.color);
    if (!colorVariant) {
      throw new Error(`Variant not found: ${item.size} - ${item.color}`);
    }

    if (colorVariant.quantity < item.quantity) {
      throw new Error(`Not enough stock for ${product.name}`);
    }

    colorVariant.quantity -= item.quantity;
    colorVariant.reserved = (colorVariant.reserved || 0) + item.quantity;

    await product.save();
  }
};

export const releaseReservedStock = async (items) => {
  for (const item of items) {
    const product = await productModel.findById(item.productId);
    if (!product) continue;

    const colorVariant = getColorVariant(product, item.size, item.color);
    if (!colorVariant) continue;

    const releasable = Math.min(colorVariant.reserved || 0, item.quantity);
    colorVariant.reserved = (colorVariant.reserved || 0) - releasable;
    colorVariant.quantity += releasable;

    await product.save();
  }
};

export const finalizeReservedStock = async (items) => {
  for (const item of items) {
    const product = await productModel.findById(item.productId);
    if (!product) continue;

    const colorVariant = getColorVariant(product, item.size, item.color);
    if (!colorVariant) continue;

    const finalized = Math.min(colorVariant.reserved || 0, item.quantity);
    colorVariant.reserved = (colorVariant.reserved || 0) - finalized;
    colorVariant.sold = (colorVariant.sold || 0) + finalized;

    await product.save();
  }
};
