import Interaction from "../model/Interaction.model.js";
import productModel from "../model/product.model.js";
import userModel from "../model/user.model.js";
import { getRecommendedProductIds } from "../utils/recommendationLoader.js";
import { computeUserVector, findTopNByUserVector } from "../utils/foldingIn.js";
 
const RECENT_LIMIT   = 20;
const ALS_WEIGHT     = 0.70;
const FOLDING_WEIGHT = 0.30;
 
let _availableIdsCache = null;
let _availableIdsCachedAt = null;
const AVAILABLE_IDS_TTL = 5 * 60 * 1000;
 
async function getAvailableMlIds() {
  const now = Date.now();
  if (_availableIdsCache && _availableIdsCachedAt && now - _availableIdsCachedAt < AVAILABLE_IDS_TTL) {
    return _availableIdsCache;
  }
  const docs = await productModel.find(
    { ml_product_id: { $ne: null }, status: "active", stock: { $gt: 0 } },
    { ml_product_id: 1 }
  ).lean();
  _availableIdsCache    = docs.map(d => d.ml_product_id);
  _availableIdsCachedAt = now;
  return _availableIdsCache;
}
 
async function getRecentInteractions(userId) {
  const rows = await Interaction.find({ userId })
    .sort({ createdAt: -1 })
    .limit(RECENT_LIMIT)
    .populate({ path: "productId", select: "ml_product_id status" })
    .lean();
  return rows.filter(r => r.productId?.ml_product_id != null);
}
 
async function getALSProducts(mlUserId, limit) {
  const mlIds = getRecommendedProductIds(mlUserId);
  if (!mlIds.length) return [];
 
  const products = await productModel.find({
    ml_product_id: { $in: mlIds },
    status: "active",
    stock: { $gt: 0 },
  }).select("name price variants categoryId ml_product_id stats").lean();
 
  const map = new Map(products.map(p => [p.ml_product_id, p]));
  return mlIds
    .map(id => map.get(id))
    .filter(Boolean)
    .slice(0, limit)
    .map(p => ({ ...p, explanation: { reason: "Người dùng tương tự bạn cũng thích sản phẩm này" } }));
}
 
async function getFoldingInProducts(interactions, limit) {
  const input = interactions.map(r => ({
    ml_product_id: r.productId.ml_product_id,
    score: r.score,
  }));
 
  const userVector = computeUserVector(input);
  if (!userVector) return [];
 
  const availableIds = await getAvailableMlIds();
  const excludeIds   = input.map(r => r.ml_product_id);
  const topItems     = findTopNByUserVector(userVector, excludeIds, limit * 2, availableIds);
 
  if (!topItems.length) return [];
 
  const mlIds    = topItems.map(t => t.ml_product_id);
  const scoreMap = new Map(topItems.map(t => [t.ml_product_id, t.score]));
 
  const products = await productModel.find({
    ml_product_id: { $in: mlIds },
    status: "active",
    stock: { $gt: 0 },
  }).select("name price variants categoryId ml_product_id stats").lean();
 
  return products
    .sort((a, b) => (scoreMap.get(b.ml_product_id) ?? 0) - (scoreMap.get(a.ml_product_id) ?? 0))
    .slice(0, limit)
    .map(p => ({ ...p, explanation: { reason: "Dựa trên sản phẩm bạn vừa xem" } }));
}
 
async function getTrending(limit) {
  return productModel.find({ status: "active", stock: { $gt: 0 } })
    .sort({ "stats.purchase_count": -1, "stats.view_count": -1 })
    .limit(limit)
    .select("name price variants categoryId stats")
    .lean()
    .then(products => products.map(p => ({
      ...p,
      explanation: { reason: "Sản phẩm được mua nhiều nhất tuần này" },
    })));
}
 
function mergeAndDedupe(primary, secondary, limit) {
  const seen   = new Set();
  const result = [];
  for (const p of [...primary, ...secondary]) {
    if (result.length >= limit) break;
    const id = String(p._id);
    if (!seen.has(id)) { seen.add(id); result.push(p); }
  }
  return result;
}
 
export async function getHybridRecommendations(userId, limit = 10) {
  const user = await userModel.findById(userId).select("ml_user_id has_ml_profile name").lean();
  if (!user) throw new Error("Không tìm thấy user");
 
  const recentInteractions = await getRecentInteractions(userId);
  const hasHistory   = recentInteractions.length > 0;
  const hasMLProfile = user.has_ml_profile && user.ml_user_id != null;
 
  if (!hasMLProfile && !hasHistory) {
    return { products: await getTrending(limit), type: "trending", cold_start: true };
  }
 
  if (!hasMLProfile && hasHistory) {
    let products = await getFoldingInProducts(recentInteractions, limit);
    if (products.length < limit) {
      const extra = await getTrending(limit - products.length);
      products = mergeAndDedupe(products, extra, limit);
    }
    return {
      products,
      type:       "folding_in",
      cold_start: true,
      message:    "Gợi ý dựa trên lịch sử xem của bạn",
    };
  }
 
  const alsLimit     = Math.ceil(limit * ALS_WEIGHT) + 5;
  const foldingLimit = Math.ceil(limit * FOLDING_WEIGHT) + 5;
 
  const [alsProducts, foldingProducts] = await Promise.all([
    getALSProducts(user.ml_user_id, alsLimit),
    hasHistory ? getFoldingInProducts(recentInteractions, foldingLimit) : Promise.resolve([]),
  ]);
 
  let products = mergeAndDedupe(alsProducts, foldingProducts, limit);
 
  if (products.length < limit) {
    const extra = await getTrending(limit - products.length);
    products = mergeAndDedupe(products, extra, limit);
  }
 
  return {
    products,
    type:       "hybrid",
    cold_start: false,
    message:    `Gợi ý cá nhân hóa cho ${user.name || "bạn"}`,
  };
}