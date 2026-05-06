import express from "express";
import productController from "../controller/product.controller.js";
import userMiddleware from "../middleware/user.middleware.js";

const productRouter = express.Router();

productRouter.post("/", productController.createProduct);
productRouter.get("/", productController.getProducts);
productRouter.get("/:id", productController.getProductById);
productRouter.get(
  "/sku/:sku",
  userMiddleware.optionalAuth,
  productController.getProductBySku
);
productRouter.put("/:id", productController.updateProduct);
productRouter.delete("/:id", productController.deleteProduct);
productRouter.get(
  "/admin/top-purchased",
  productController.getTopPurchasedProducts
);
productRouter.post("/ai/recommend", productController.recommendByAI);

export default productRouter;
