import { callAI } from "../../utils/gemini.util.js";
import { getCache, setCache } from "../../utils/aiCache.util.js";

function fallbackKeywords(userQuery) {
  return {
    keywords: userQuery.split(/\s+/).filter((w) => w.length > 1),
    priceMin: 0,
    priceMax: -1,
    sortBy: "newest",
    explanation: `Kết quả tìm kiếm cho: "${userQuery}"`,
    isFallback: true,
  };
}

async function extractKeywordsFromQuery(userQuery) {
  const cacheKey = `ai:search:${userQuery.toLowerCase().trim().replace(/\s+/g, "_")}`;
  const cached = getCache(cacheKey);
  if (cached) return { ...cached, fromCache: true };

  if (!process.env.GEMINI_API_KEY) return fallbackKeywords(userQuery);

  try {
    const text = await callAI(
      `Bạn là AI hỗ trợ tìm kiếm sản phẩm thời trang Việt Nam.
Nhiệm vụ: Phân tích mô tả của khách và trả về từ khóa tìm kiếm phù hợp.
Chỉ trả JSON thuần, không markdown, không giải thích.`,
      `Khách mô tả: "${userQuery}"

Trả về JSON:
{
  "keywords": ["keyword1", "keyword2"],
  "priceMin": 0,
  "priceMax": -1,
  "sortBy": "newest",
  "explanation": "AI hiểu: ... (tiếng Việt, 1 câu ngắn)"
}

Lưu ý:
- keywords: 3-6 từ khóa ngắn tiếng Việt liên quan tên/mô tả sản phẩm quần áo
- priceMax = -1 nghĩa là không giới hạn
- sortBy: "newest" | "price_asc" | "price_desc"`,
      300
    );

    const clean = text.replace(/```json|```/gi, "").trim();
    const result = JSON.parse(clean);
    setCache(cacheKey, result, 3600);
    return result;

  } catch (err) {
    console.warn("[AI Search] Gemini lỗi, dùng fallback:", err.message);
    return fallbackKeywords(userQuery);
  }
}

export async function aiSearchProducts(productModel, userQuery, page = 1, limit = 20) {
  const ai = await extractKeywordsFromQuery(userQuery);

  const keywordConditions = ai.keywords.flatMap((kw) => [
    { name:          { $regex: kw, $options: "i" } },
    { nameEn:        { $regex: kw, $options: "i" } },
    { description:   { $regex: kw, $options: "i" } },
    { descriptionEn: { $regex: kw, $options: "i" } },
  ]);

  const matchQuery = {
    status: "active",
    ...(keywordConditions.length > 0 && { $or: keywordConditions }),
  };

  if (ai.priceMin > 0 || ai.priceMax > 0) {
    matchQuery.price = {};
    if (ai.priceMin > 0) matchQuery.price.$gte = ai.priceMin;
    if (ai.priceMax > 0) matchQuery.price.$lte = ai.priceMax;
  }

  const sortMap = {
    newest:     { createdAt: -1 },
    price_asc:  { price: 1 },
    price_desc: { price: -1 },
  };

  const [products, total] = await Promise.all([
    productModel
      .find(matchQuery)
      .populate("categoryId", "name")
      .sort(sortMap[ai.sortBy] || sortMap.newest)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    productModel.countDocuments(matchQuery),
  ]);

  return {
    products,
    total,
    page,
    totalPages:    Math.ceil(total / limit),
    aiExplanation: ai.explanation,
    fromCache:     ai.fromCache  || false,
    isFallback:    ai.isFallback || false,
  };
}
