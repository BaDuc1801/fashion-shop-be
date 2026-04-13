import express from "express";
import upload from "../middleware/upload.middleware.js";
import productController from "../controller/product.controller.js";

const productRouter = express.Router();

productRouter.post("/", productController.createProduct);
productRouter.get("/", productController.getProducts);
productRouter.get("/:id", productController.getProductById);
productRouter.put("/:id", productController.updateProduct);
productRouter.delete("/:id", productController.deleteProduct);

export default productRouter;
