import mongoose from "mongoose";
import ratingModel from "../model/rating.model.js";
import productModel from "../model/product.model.js";
import userModel from "../model/user.model.js";
import { checkToxicComment } from "../services/moderation.service.js";
import { maskByRanges } from "../utils/rating.utils.js";

const ratingController = {
  // CREATE
  createRating: async (req, res) => {
    try {
      const { productId, rating, comment, images, orderId } = req.body;
      const userId = req.user.id;

      let isToxic = false;
      let toxicityReason = "";
      let toxicityReasonEn = "";

      if (comment?.trim()) {
        const check = await checkToxicComment(comment);

        isToxic = check.toxic;
        toxicityReason = check.reason;
        toxicityReasonEn = check.reasonEn;
      }

      const newRating = await ratingModel.create({
        orderId,
        userId,
        productId,
        rating,
        comment,
        images,
        isToxic,
        toxicityReason,
        toxicityReasonEn,
        isPublic: !isToxic,
        maskedRanges: [],
      });

      const stats = await ratingModel.calcAverageRating(productId);

      res.status(201).json({
        message: isToxic ? "Review is waiting for admin approval" : "Created",
        data: newRating,
        ratingStats: stats,
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
  getReviewsByProduct: async (req, res) => {
    try {
      const { productId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      const pageNum = Number(page);
      const limitNum = Number(limit);
      const skip = (pageNum - 1) * limitNum;

      const query = {
        productId: new mongoose.Types.ObjectId(productId),
        isPublic: true,
      };

      const [reviews, total, stats] = await Promise.all([
        ratingModel
          .find(query)
          .populate("userId", "name avatar")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum),

        ratingModel.countDocuments(query),

        ratingModel.calcAverageRating(productId),
      ]);

      res.json({
        data: reviews,
        ratingStats: stats,
        pagination: {
          total,
          page: pageNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  // GET MY REVIEWS
  getMyReviews: async (req, res) => {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 10 } = req.query;

      const pageNum = Number(page);
      const limitNum = Number(limit);
      const skip = (pageNum - 1) * limitNum;

      const [reviews, total] = await Promise.all([
        ratingModel
          .find({ userId })
          .populate("productId", "name images price sku")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum),

        ratingModel.countDocuments({ userId }),
      ]);

      res.json({
        data: reviews,
        pagination: {
          total,
          page: pageNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  updateRating: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const rating = await ratingModel.findOne({
        _id: id,
        userId,
      });

      if (!rating) {
        return res.status(404).json({ message: "Not found" });
      }

      const { rating: newRating, comment, images } = req.body;

      if (newRating) rating.rating = newRating;
      if (comment !== undefined) rating.comment = comment;
      if (images) rating.images = images;

      await rating.save();

      const stats = await ratingModel.calcAverageRating(rating.productId);

      res.json({
        message: "Updated",
        data: rating,
        ratingStats: stats,
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  // DELETE RATING (USER)
  deleteRating: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const rating = await ratingModel.findOneAndDelete({
        _id: id,
        userId,
      });

      if (!rating) {
        return res.status(404).json({ message: "Not found" });
      }

      const stats = await ratingModel.calcAverageRating(rating.productId);

      res.json({
        message: "Deleted",
        ratingStats: stats,
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  getAllReviewsAdmin: async (req, res) => {
    try {
      const { page = 1, limit = 10, productId, search, rate } = req.query;

      const pageNum = Number(page);
      const limitNum = Number(limit);
      const skip = (pageNum - 1) * limitNum;

      const query = {};

      if (productId) {
        query.productId = new mongoose.Types.ObjectId(productId);
      }

      if (rate) {
        query.rating = Number(rate);
      }

      if (search) {
        const regex = new RegExp(search, "i");

        const products = await productModel.find({ name: regex }).select("_id");

        const users = await userModel.find({ name: regex }).select("_id");

        const productIds = products.map((p) => p._id);
        const userIds = users.map((u) => u._id);

        query.$or = [
          { comment: regex },
          { productId: { $in: productIds } },
          { userId: { $in: userIds } },
        ];
      }

      const [reviews, total] = await Promise.all([
        ratingModel
          .find(query)
          .populate("userId", "name avatar")
          .populate("productId", "name")
          .sort({ isToxic: -1, createdAt: -1 })
          .skip(skip)
          .limit(limitNum),

        ratingModel.countDocuments(query),
      ]);

      res.json({
        data: reviews,
        pagination: {
          total,
          page: pageNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  togglePublish: async (req, res) => {
    try {
      const { id } = req.params;

      const rating = await ratingModel.findById(id);
      if (!rating) {
        return res.status(404).json({ message: "Not found" });
      }

      rating.isPublic = !rating.isPublic;

      await rating.save();

      const stats = await ratingModel.calcAverageRating(rating.productId);

      res.json({
        message: rating.isPublic ? "Published" : "Hidden",
        data: rating,
        ratingStats: stats,
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  checkComment: async (req, res) => {
    try {
      const { comment } = req.body;
      const result = await checkToxicComment(comment);
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  maskComment: async (req, res) => {
    try {
      const { ratingId, ranges } = req.body;

      if (!ratingId || !Array.isArray(ranges)) {
        return res.status(400).json({
          message: "ratingId and ranges are required",
        });
      }

      const rating = await ratingModel.findById(ratingId);

      if (!rating) {
        return res.status(404).json({
          message: "Rating not found",
        });
      }

      const original = rating.comment || "";

      const maskedText = maskByRanges(original, ranges);

      rating.maskedComment = maskedText;
      rating.maskedRanges = ranges;

      await rating.save();

      return res.json({
        message: "Masked successfully",
        data: rating,
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
};

export default ratingController;
