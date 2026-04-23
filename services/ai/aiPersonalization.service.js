import { callAI } from "../../utils/gemini.util.js";
import { getCache, setCache, deleteCache } from "../../utils/aiCache.util.js";

export async function trackUserEvent(userBehaviorModel, userId, eventData) {
  await userBehaviorModel.findOneAndUpdate(
    { userId },
    {
      $push: {
        events: {
          $each: [{ ...eventData, createdAt: new Date() }],
          $slice: -150,
        },
      },
    },
    { upsert: true, new: true }
  );
  deleteCache(`ai:recommend:${userId}`);
}

function summarizeEvents(events) {
  const productCount = {}, categoryCount = {}, searches = [], prices = [];
  for (const e of events) {
    if (e.productName)  productCount[e.productName]   = (productCount[e.productName]   || 0) + 1;
    if (e.categoryName) categoryCount[e.categoryName] = (categoryCount[e.categoryName] || 0) + 1;
    if (e.type === "search" && e.searchQuery) searches.push(e.searchQuery);
    if (e.price) prices.push(e.price);
  }
  return {
    topProducts:   Object.entries(productCount).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([n])=>n),
    topCategories: Object.entries(categoryCount).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([n])=>n),
    recentSearches: [...new Set(searches)].slice(-8),
    avgPrice: prices.length ? Math.round(prices.reduce((a,b)=>a+b,0)/prices.length) : null,
  };
}

function fallbackProfile(summary) {
  if (!summary.topProducts.length && !summary.topCategories.length) return { hasProfile: false };
  return {
    hasProfile: true,
    keywords: [...summary.topCategories, ...summary.topProducts.slice(0, 3)],
    priceMin: summary.avgPrice ? summary.avgPrice * 0.5 : 0,
    priceMax: summary.avgPrice ? summary.avgPrice * 1.5 : 0,
    isFallback: true,
  };
}

async function buildStyleProfile(userBehaviorModel, userId) {
  const cacheKey = `ai:style:${userId}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const behavior = await userBehaviorModel.findOne({ userId }).lean();
  if (!behavior?.events?.length) return { hasProfile: false };

  const summary = summarizeEvents(behavior.events);
  if (!process.env.GEMINI_API_KEY) return fallbackProfile(summary);

  try {
    const text = await callAI(
      "Phân tích lịch sử mua sắm quần áo, trả về preference. Chỉ trả JSON thuần, không markdown.",
      `Lịch sử: ${JSON.stringify(summary)}

Trả về JSON:
{
  "keywords": ["từ khóa phong cách"],
  "priceMin": 0,
  "priceMax": 0
}`,
      200
    );

    const clean = text.replace(/```json|```/gi, "").trim();
    const profile = { ...JSON.parse(clean), hasProfile: true };
    setCache(cacheKey, profile, 86400);
    return profile;

  } catch (err) {
    console.warn("[AI Personalization] Gemini lỗi, dùng fallback:", err.message);
    return fallbackProfile(summary);
  }
}

export async function getPersonalizedProducts(userBehaviorModel, productModel, userId, limit = 10) {
  const cacheKey = `ai:recommend:${userId}:${limit}`;
  const cached = getCache(cacheKey);
  if (cached) return { ...cached, fromCache: true };

  const profile = await buildStyleProfile(userBehaviorModel, userId);

  const behavior = await userBehaviorModel.findOne({ userId }).lean();
  const seenIds = behavior?.events
    ?.filter((e) => ["view", "purchase"].includes(e.type) && e.productId)
    ?.map((e) => e.productId) ?? [];

  const query = { status: "active" };
  if (seenIds.length) query._id = { $nin: seenIds };

  if (profile.hasProfile) {
    if (profile.keywords?.length) {
      query.$or = profile.keywords.flatMap((kw) => [
        { name:        { $regex: kw, $options: "i" } },
        { description: { $regex: kw, $options: "i" } },
      ]);
    }
    if (profile.priceMin > 0 || profile.priceMax > 0) {
      query.price = {};
      if (profile.priceMin > 0) query.price.$gte = profile.priceMin * 0.7;
      if (profile.priceMax > 0) query.price.$lte = profile.priceMax * 1.3;
    }
  }

  let products = await productModel
    .find(query)
    .populate("categoryId", "name")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

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
  setCache(cacheKey, result, 1800);
  return result;
}
