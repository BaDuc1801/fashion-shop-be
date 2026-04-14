import productModel from "../model/product.model.js";

export const getProductCountByCategory = async (categoryId) => {
  return await productModel.countDocuments({
    categoryId,
    status: "active",
  });
};
