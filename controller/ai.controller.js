import productModel     from "../model/product.model.js";
import reviewModel      from "../model/review.model.js";
import userBehaviorModel from "../model/userBehavior.model.js";

import { aiSearchProducts }        from "../services/ai/aiSearch.service.js";
import { getPersonalizedProducts, trackUserEvent } from "../services/ai/aiPersonalization.service.js";
import { moderateReview, moderateBatch }           from "../services/ai/aiModeration.service.js";

const aiController = {

  // POST /api/ai/search
  // Body: { query: "đồ đi làm thanh lịch", page: 1, limit: 20 }
  search: async (req, res) => {
    try {
      const { query, page = 1, limit = 20 } = req.body;

      if (!query?.trim() || query.trim().length < 2) {
        return res.status(400).json({ message: "Vui lòng nhập mô tả tìm kiếm" });
      }

      const result = await aiSearchProducts(
        productModel,
        query.trim(),
        Number(page),
        Number(limit)
      );

      // Ghi nhận hành vi tìm kiếm nếu đã đăng nhập (không chặn response)
      const userId = req.user?._id || req.user?.id;
      if (userId) {
        trackUserEvent(userBehaviorModel, userId, {
          type: "search",
          searchQuery: query.trim(),
        }).catch(() => {});
      }

      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      console.error("[ai.search]", error.message);
      return res.status(500).json({ message: "Lỗi AI tìm kiếm" });
    }
  },

  // GET /api/ai/recommendations?limit=10
  // Yêu cầu đăng nhập (dùng verifyToken middleware)
  getRecommendations: async (req, res) => {
    try {
      const userId = req.user?._id || req.user?.id;
      const limit  = Math.min(Number(req.query.limit) || 10, 30);

      const result = await getPersonalizedProducts(
        userBehaviorModel,
        productModel,
        userId,
        limit
      );

      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      console.error("[ai.getRecommendations]", error.message);
      return res.status(500).json({ message: "Lỗi AI gợi ý sản phẩm" });
    }
  },

  // POST /api/ai/track
  // Body: { type, productId, productName, categoryId, categoryName, price, searchQuery }
  // FE gọi silent — không hiển thị kết quả cho người dùng
  track: async (req, res) => {
    try {
      const userId = req.user?._id || req.user?.id;
      if (!userId) return res.sendStatus(204);

      const { type, productId, productName, categoryId, categoryName, price, searchQuery } = req.body;
      const validTypes = ["view", "search", "cart", "purchase"];
      if (!validTypes.includes(type)) return res.sendStatus(400);

      await trackUserEvent(userBehaviorModel, userId, {
        type, productId, productName, categoryId, categoryName, price, searchQuery,
      });

      return res.sendStatus(204);
    } catch (error) {
      console.error("[ai.track]", error.message);
      return res.sendStatus(500);
    }
  },

  // POST /api/ai/reviews
  // Body: { productId, rating, comment }
  // Yêu cầu đăng nhập
  submitReview: async (req, res) => {
    try {
      const { productId, rating, comment } = req.body;
      const userId = req.user?._id || req.user?.id;

      if (!productId || !rating || !comment) {
        return res.status(400).json({ message: "Thiếu thông tin đánh giá" });
      }
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Số sao phải từ 1 đến 5" });
      }

      // Kiểm tra sản phẩm tồn tại
      const product = await productModel.findOne({ _id: productId, status: "active" });
      if (!product) {
        return res.status(404).json({ message: "Sản phẩm không tồn tại" });
      }

      // AI kiểm duyệt
      const modResult = await moderateReview(comment, rating);

      // Lưu review
      const review = await reviewModel.create({
        productId,
        userId,
        rating,
        comment: comment.trim(),
        moderation: {
          status: modResult.status,
          reason: modResult.reason || "",
          score:  modResult.score  || 0,
        },
        isVisible: modResult.status === "approved",
      });

      // Cập nhật rating trung bình sản phẩm nếu được duyệt
      if (modResult.status === "approved") {
        updateProductRating(productId).catch(() => {});
      }

      const messages = {
        approved:    "Cảm ơn bạn! Đánh giá đã được đăng.",
        need_review: "Cảm ơn bạn! Đánh giá đang chờ xem xét.",
        rejected:    `Đánh giá bị từ chối: ${modResult.reason}`,
      };

      return res
        .status(modResult.status === "rejected" ? 422 : 201)
        .json({
          success:  modResult.status !== "rejected",
          message:  messages[modResult.status],
          reviewId: review._id,
        });
    } catch (error) {
      console.error("[ai.submitReview]", error.message);
      return res.status(500).json({ message: "Lỗi hệ thống" });
    }
  },

  // GET /api/ai/reviews/:productId?page=1&limit=10
  // Public
  getReviews: async (req, res) => {
    try {
      const { productId } = req.params;
      const page  = Number(req.query.page)  || 1;
      const limit = Number(req.query.limit) || 10;

      const [reviews, total] = await Promise.all([
        reviewModel
          .find({ productId, isVisible: true })
          .populate("userId", "name avatar")
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        reviewModel.countDocuments({ productId, isVisible: true }),
      ]);

      // Tính rating trung bình
      const ratingStats = await reviewModel.aggregate([
        { $match: { productId: new (await import("mongoose")).default.Types.ObjectId(productId), isVisible: true } },
        { $group: { _id: null, avg: { $avg: "$rating" }, total: { $sum: 1 } } },
      ]);

      return res.status(200).json({
        success: true,
        data: {
          reviews,
          total,
          page,
          totalPages: Math.ceil(total / limit),
          avgRating: ratingStats[0]?.avg
            ? Math.round(ratingStats[0].avg * 10) / 10
            : 0,
        },
      });
    } catch (error) {
      console.error("[ai.getReviews]", error.message);
      return res.status(500).json({ message: "Lỗi hệ thống" });
    }
  },

  // POST /api/ai/reviews/batch-moderate
  batchModerate: async (req, res) => {
    try {
      const pendingReviews = await reviewModel
        .find({ "moderation.status": { $in: ["pending", "need_review"] } })
        .limit(50)
        .lean();

      if (!pendingReviews.length) {
        return res.status(200).json({ message: "Không có review nào cần kiểm duyệt", total: 0 });
      }

      const results = await moderateBatch(
        pendingReviews.map((r) => ({ id: r._id, comment: r.comment, rating: r.rating }))
      );

      // Cập nhật hàng loạt vào DB
      await reviewModel.bulkWrite(
        results.map(({ id, moderation }) => ({
          updateOne: {
            filter: { _id: id },
            update: {
              $set: {
                "moderation.status": moderation.status,
                "moderation.reason": moderation.reason || "",
                "moderation.score":  moderation.score  || 0,
                isVisible: moderation.status === "approved",
              },
            },
          },
        }))
      );

      // Cập nhật rating cho các SP có review được duyệt
      const approvedProductIds = results
        .filter((r) => r.moderation.status === "approved")
        .map((r) => pendingReviews.find((p) => String(p._id) === String(r.id))?.productId)
        .filter(Boolean);

      await Promise.allSettled(approvedProductIds.map(updateProductRating));

      return res.status(200).json({
        success:    true,
        total:      results.length,
        approved:   results.filter((r) => r.moderation.status === "approved").length,
        needReview: results.filter((r) => r.moderation.status === "need_review").length,
        rejected:   results.filter((r) => r.moderation.status === "rejected").length,
      });
    } catch (error) {
      console.error("[ai.batchModerate]", error.message);
      return res.status(500).json({ message: "Lỗi hệ thống" });
    }
  },
};

// ─── Helper ───────────────────────────────────────────────────────────────────
async function updateProductRating(productId) {
  const mongoose = (await import("mongoose")).default;
  const stats = await reviewModel.aggregate([
    {
      $match: {
        productId: new mongoose.Types.ObjectId(String(productId)),
        isVisible: true,
      },
    },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
}

export default aiController;