import express from "express";
import ratingController from "../controller/rating.controller.js";
import userMiddleware from "../middleware/user.middleware.js";

const ratingRouter = express.Router();

ratingRouter.post(
  "/",
  userMiddleware.verifyToken,
  ratingController.createRating
);
ratingRouter.get("/:productId", ratingController.getReviewsByProduct);
ratingRouter.get(
  "/my-reviews",
  userMiddleware.verifyToken,
  ratingController.getMyReviews
);
ratingRouter.put(
  "/:id",
  userMiddleware.verifyToken,
  ratingController.updateRating
);
ratingRouter.delete(
  "/:id",
  userMiddleware.verifyToken,
  ratingController.deleteRating
);
ratingRouter.get("/admin/all", ratingController.getAllReviewsAdmin);
ratingRouter.put("/admin/toggle-publish/:id", ratingController.togglePublish);
ratingRouter.post("/check-comment", ratingController.checkComment);
ratingRouter.post("/mask-comment", ratingController.maskComment);

export default ratingRouter;
