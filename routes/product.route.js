import express from "express";
import productController from "../controller/product.controller.js";

const productRouter = express.Router();

productRouter.post("/", productController.createProduct);
productRouter.get("/", productController.getProducts);
productRouter.get("/:id", productController.getProductById);
productRouter.get("/sku/:sku", productController.getProductBySku);
productRouter.put("/:id", productController.updateProduct);
productRouter.delete("/:id", productController.deleteProduct);

export default productRouter;
