import { getHybridRecommendations } from "../services/hybridRecommender.js";
import productModel from "../model/product.model.js";

export const getRecommendations = async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    const result = await getHybridRecommendations(userId, limit);

    res.json({
      success: true,
      type:       result.type,
      cold_start: result.cold_start,
      message:    result.message,
      products:   result.products,
      meta: {
        total:   result.products.length,
        user_id: userId,
      },
    });
  } catch (err) {
    console.error("[getRecommendations]", err);
    res.status(500).json({ success: false, message: err.message || "Lỗi server" });
  }
};

export const getTrending = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const products = await productModel.find({ status: "active", stock: { $gt: 0 } })
      .sort({ "stats.purchase_count": -1, "stats.view_count": -1 })
      .limit(limit)
      .select("name price images category style color brand stats")
      .lean();

    res.json({
      success:  true,
      type:     "trending",
      products: products.map((p) => ({
        ...p,
        explanation: { reason: "Sản phẩm được mua nhiều nhất tuần này" },
      })),
      meta: { total: products.length },
    });
  } catch (err) {
    console.error("[getTrending]", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};
