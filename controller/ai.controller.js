import productModel      from "../model/product.model.js";
import ratingModel       from "../model/rating.model.js";       
import userBehaviorModel from "../model/userBehavior.model.js";

import { aiSearchProducts }                          from "../services/ai/aiSearch.service.js";
import { getPersonalizedProducts, trackUserEvent }   from "../services/ai/aiPersonalization.service.js";
import { moderateReview, moderateBatch }             from "../services/ai/aiModeration.service.js";

const aiController = {

  // POST /api/ai/search
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

      const userId = req.user?.id;
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

  // GET /api/ai/recommendations
  getRecommendations: async (req, res) => {
    try {
      const userId = req.user?.id;
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
  track: async (req, res) => {
    try {
      const userId = req.user?.id;
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

  // POST /api/ai/ratings
  submitRating: async (req, res) => {
    try {
      const { productId, orderId, rating, comment, images } = req.body;
      const userId = req.user?.id;

      if (!productId || !orderId || !rating) {
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

      // Kiểm tra đã rating đơn hàng này chưa
      const existed = await ratingModel.findOne({ userId, orderId, productId });
      if (existed) {
        return res.status(400).json({ message: "Bạn đã đánh giá sản phẩm này rồi" });
      }

      // AI kiểm duyệt comment (chỉ kiểm duyệt nếu có comment)
      let modResult = { status: "approved", reason: "", score: 1 };
      if (comment?.trim()) {
        modResult = await moderateReview(comment, rating);
      }

      // Lưu rating — dùng isPublic thay isVisible
      const newRating = await ratingModel.create({
        productId,
        orderId,
        userId,
        rating,
        comment: comment?.trim() || "",
        images:  images || [],
        isPublic: modResult.status === "approved",
        moderation: {
          status: modResult.status,
          reason: modResult.reason || "",
          score:  modResult.score  || 0,
        },
      });

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
          ratingId: newRating._id,
        });
    } catch (error) {
      console.error("[ai.submitRating]", error.message);
      return res.status(500).json({ message: "Lỗi hệ thống" });
    }
  },

  // GET /api/ai/ratings/:productId
  getRatings: async (req, res) => {
    try {
      const { productId } = req.params;
      const page  = Number(req.query.page)  || 1;
      const limit = Number(req.query.limit) || 10;

      const [ratings, total, stats] = await Promise.all([
        ratingModel
          .find({ productId, isPublic: true })
          .populate("userId", "name avatar")
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        ratingModel.countDocuments({ productId, isPublic: true }),
        ratingModel.calcAverageRating(productId), // dùng static method có sẵn
      ]);

      return res.status(200).json({
        success: true,
        data: {
          ratings,
          total,
          page,
          totalPages: Math.ceil(total / limit),
          avgRating:   stats.avgRating,
          totalRatings: stats.totalRatings,
        },
      });
    } catch (error) {
      console.error("[ai.getRatings]", error.message);
      return res.status(500).json({ message: "Lỗi hệ thống" });
    }
  },

  // POST /api/ai/ratings/batch-moderate — Admin duyệt hàng loạt
  batchModerate: async (req, res) => {
    try {
      const pending = await ratingModel
        .find({ "moderation.status": { $in: ["pending", "need_review"] } })
        .limit(50)
        .lean();

      if (!pending.length) {
        return res.status(200).json({ message: "Không có đánh giá nào cần kiểm duyệt", total: 0 });
      }

      const results = await moderateBatch(
        pending.map((r) => ({ id: r._id, comment: r.comment, rating: r.rating }))
      );

      await ratingModel.bulkWrite(
        results.map(({ id, moderation }) => ({
          updateOne: {
            filter: { _id: id },
            update: {
              $set: {
                "moderation.status": moderation.status,
                "moderation.reason": moderation.reason || "",
                "moderation.score":  moderation.score  || 0,
                isPublic: moderation.status === "approved",
              },
            },
          },
        }))
      );

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

export default aiController;
