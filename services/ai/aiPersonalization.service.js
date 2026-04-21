import anthropic from "../../utils/anthropic.util.js";
import { getCache, setCache, deleteCache } from "../../utils/aiCache.util.js";

// ─── Track hành vi ────────────────────────────────────────────────────────────

export async function trackUserEvent(userBehaviorModel, userId, eventData) {
  await userBehaviorModel.findOneAndUpdate(
    { userId },
    {
      $push: {
        events: {
          $each: [{ ...eventData, createdAt: new Date() }],
          $slice: -150, // giữ 150 event gần nhất
        },
      },
    },
    { upsert: true, new: true }
  );

  // Xóa cache gợi ý cũ — lần sau sẽ tạo mới dựa trên hành vi mới
  deleteCache(`ai:recommend:${userId}`);
}

// ─── Phân tích phong cách người dùng ─────────────────────────────────────────

/**
 * Tóm tắt events thành dạng gọn trước khi gửi AI — tránh tốn token
 */
function summarizeEvents(events) {
  const productCount  = {};
  const categoryCount = {};
  const searches      = [];
  const prices        = [];

  for (const e of events) {
    if (e.productName)  productCount[e.productName]   = (productCount[e.productName]   || 0) + 1;
    if (e.categoryName) categoryCount[e.categoryName] = (categoryCount[e.categoryName] || 0) + 1;
    if (e.type === "search" && e.searchQuery) searches.push(e.searchQuery);
    if (e.price) prices.push(e.price);
  }

  return {
    topProducts: Object.entries(productCount)
      .sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name]) => name),
    topCategories: Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name]) => name),
    recentSearches: [...new Set(searches)].slice(-8),
    avgPrice: prices.length
      ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
      : null,
  };
}

/**
 * AI phân tích lịch sử → profile phong cách người dùng.
 * Cache 24h, tự xóa khi trackUserEvent được gọi.
 */
async function buildStyleProfile(userBehaviorModel, userId) {
  const cacheKey = `ai:style:${userId}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const behavior = await userBehaviorModel.findOne({ userId }).lean();
  if (!behavior?.events?.length) return { hasProfile: false };

  const summary = summarizeEvents(behavior.events);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 250,
    system: "Phân tích lịch sử mua sắm quần áo, trả về preference. Chỉ trả JSON.",
    messages: [
      {
        role: "user",
        content: `Lịch sử: ${JSON.stringify(summary)}

Trả về JSON:
{
  "keywords": ["từ khóa phong cách 1", "từ khóa 2", ...],
  "priceMin": 0,
  "priceMax": 0
}

Gợi ý: keywords là từ khóa liên quan đến phong cách/loại sản phẩm user hay xem (VD: "áo sơ mi", "công sở", "casual")`,
      },
    ],
  });

  let profile = { hasProfile: false };
  try {
    const text = response.content[0].text.replace(/```json|```/gi, "").trim();
    profile = { ...JSON.parse(text), hasProfile: true };
  } catch {}

  setCache(cacheKey, profile, 86400);
  return profile;
}

// ─── Gợi ý sản phẩm ──────────────────────────────────────────────────────────

/**
 * Trả về sản phẩm gợi ý cá nhân hóa cho user đã đăng nhập.
 *
 * @param {Model}  userBehaviorModel
 * @param {Model}  productModel       - import từ product.model.js
 * @param {string} userId             - req.user._id hoặc req.user.id
 * @param {number} limit
 */
export async function getPersonalizedProducts(
  userBehaviorModel,
  productModel,
  userId,
  limit = 10
) {
  const cacheKey = `ai:recommend:${userId}:${limit}`;
  const cached = getCache(cacheKey);
  if (cached) return { ...cached, fromCache: true };

  const profile = await buildStyleProfile(userBehaviorModel, userId);

  // Lấy productId đã xem/mua để loại khỏi gợi ý (không hiện lại SP cũ)
  const behavior = await userBehaviorModel.findOne({ userId }).lean();
  const seenIds = behavior?.events
    ?.filter((e) => ["view", "purchase"].includes(e.type) && e.productId)
    ?.map((e) => e.productId) ?? [];

  const query = { status: "active" };
  if (seenIds.length) query._id = { $nin: seenIds };

  // Thêm điều kiện từ profile phong cách
  if (profile.hasProfile) {
    if (profile.keywords?.length) {
      query.$or = profile.keywords.flatMap((kw) => [
        { name:        { $regex: kw, $options: "i" } },
        { description: { $regex: kw, $options: "i" } },
      ]);
    }
    if (profile.priceMin > 0 || profile.priceMax > 0) {
      query.price = {};
      if (profile.priceMin > 0) query.price.$gte = profile.priceMin * 0.7; // nới rộng 30%
      if (profile.priceMax > 0) query.price.$lte = profile.priceMax * 1.3;
    }
  }

  let products = await productModel
    .find(query)
    .populate("categoryId", "name")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  // Fallback: không đủ SP → bổ sung bằng hàng mới nhất
  if (products.length < limit) {
    const existIds = [...seenIds, ...products.map((p) => p._id)];
    const extra = await productModel
      .find({ status: "active", _id: { $nin: existIds } })
      .populate("categoryId", "name")
      .sort({ createdAt: -1 })
      .limit(limit - products.length)
      .lean();
    products = [...products, ...extra];
  }

  const result = { products, styleProfile: profile, total: products.length };
  setCache(cacheKey, result, 1800); // cache 30 phút
  return result;
}