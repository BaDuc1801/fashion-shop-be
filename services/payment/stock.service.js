import productModel from "../../model/product.model.js";

const getColorVariant = (product, sizeName, colorName) => {
  const variant = product.variants.find((v) => v.color === colorName);

  if (!variant) return null;

  return variant.skus.find((s) => s.size === sizeName) || null;
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

export const rollbackStock = async (items, oldStatus) => {
  for (const item of items) {
    const product = await productModel.findById(item.productId);
    if (!product) continue;

    const variant = product.variants.find((v) => v.color === item.color);

    if (!variant) continue;

    const sku = variant.skus.find((s) => s.size === item.size);

    if (!sku) continue;

    if (oldStatus === "pending" || oldStatus === "processing") {
      const qty = Math.min(sku.reserved || 0, item.quantity);

      sku.reserved -= qty;
      sku.quantity += qty;
    }

    if (oldStatus === "paid" || oldStatus === "completed") {
      const qty = Math.min(sku.sold || 0, item.quantity);

      sku.sold -= qty;
      sku.quantity += qty;
    }

    product.markModified("variants");
    await product.save();
  }
};

export const moveReservedToSold = async (items) => {
  for (const item of items) {
    const product = await productModel.findById(item.productId);
    if (!product) continue;

    const variant = product.variants.find((v) => v.color === item.color);

    if (!variant) continue;

    const sku = variant.skus.find((s) => s.size === item.size);

    if (!sku) continue;

    const qty = Math.min(sku.reserved || 0, item.quantity);

    if (qty <= 0) continue;

    sku.reserved -= qty;
    sku.sold += qty;

    product.markModified("variants");
    await product.save();
  }
};
