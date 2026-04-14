import express from "express";
import categoryController from "../controller/category.controller.js";
import userMiddleware from "../middleware/user.middleware.js";

const categoryRouter = express.Router();

categoryRouter.get("/", categoryController.getCategories);
categoryRouter.get("/slug/:slug", categoryController.getCategoryBySlug);
categoryRouter.get("/:id", categoryController.getCategoryById);
categoryRouter.post("/", categoryController.createCategory);
categoryRouter.put(
  "/:id",
  userMiddleware.verifyToken,
  categoryController.updateCategory
);
categoryRouter.delete(
  "/:id",
  userMiddleware.verifyToken,
  categoryController.deleteCategory
);

export default categoryRouter;
