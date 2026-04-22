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
const reviewLimit = rateLimit({
  windowMs: 3_600_000, max: 5,
  message: { message: "Chỉ được gửi 5 đánh giá mỗi giờ." },
  standardHeaders: true, legacyHeaders: false,
});

// ─── Search ───────────────────────────────────────────────────────────────────
// Khách và user đều dùng được; đăng nhập thì lưu thêm lịch sử tìm kiếm
router.post("/search", searchLimit, userMiddleware.optionalAuth, aiController.search);

// ─── Gợi ý cá nhân hóa ───────────────────────────────────────────────────────
router.get("/recommendations", userMiddleware.verifyToken, aiController.getRecommendations);

// ─── Track hành vi ───────────────────────────────────────────
router.post("/track", userMiddleware.optionalAuth, aiController.track);

// ─── Review ───────────────────────────────────────────────────────────────────
router.get("/reviews/:productId", aiController.getReviews);
router.post("/reviews", reviewLimit, userMiddleware.verifyToken, aiController.submitReview);

// ─── Admin: duyệt hàng loạt ──────────────────────────────────────────────────
router.post("/reviews/batch-moderate", userMiddleware.verifyToken, aiController.batchModerate);

export default router;