import express from "express";
import rateLimit from "express-rate-limit";
import userMiddleware from "../middleware/user.middleware.js";
import aiController from "../controller/ai.controller.js";

const router = express.Router();

const searchLimit = rateLimit({
  windowMs: 60_000, max: 30,
  message: { message: "Tìm kiếm quá nhanh, vui lòng thử lại sau." },
  standardHeaders: true, legacyHeaders: false,
});
const ratingLimit = rateLimit({
  windowMs: 3_600_000, max: 10,
  message: { message: "Chỉ được gửi 10 đánh giá mỗi giờ." },
  standardHeaders: true, legacyHeaders: false,
});

// Search & Recommend
router.post("/search",          searchLimit, userMiddleware.optionalAuth, aiController.search);
router.get("/recommendations",  userMiddleware.verifyToken,               aiController.getRecommendations);
router.post("/track",           userMiddleware.optionalAuth,              aiController.track);

// Ratings
router.get("/ratings/:productId",          aiController.getRatings);
router.post("/ratings",         ratingLimit, userMiddleware.verifyToken,  aiController.submitRating);
router.post("/ratings/batch-moderate",     userMiddleware.verifyToken,    aiController.batchModerate);

export default router;
