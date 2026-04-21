import anthropic from "../../utils/anthropic.util.js";
import { getCache, setCache } from "../../utils/aiCache.util.js";

/**
 * Gọi Claude phân tích câu mô tả thành keywords tìm kiếm.
 * Product không có field tags/color riêng nên dùng $regex trên name + description.
 */
async function extractKeywordsFromQuery(userQuery) {
  const cacheKey = `ai:search:${userQuery.toLowerCase().trim().replace(/\s+/g, "_")}`;
  const cached = getCache(cacheKey);
  if (cached) return { ...cached, fromCache: true };

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 300,
    system: `Bạn là AI hỗ trợ tìm kiếm sản phẩm thời trang Việt Nam.
Nhiệm vụ: Phân tích mô tả của khách và trả về từ khóa tìm kiếm phù hợp.
Chỉ trả JSON, không giải thích.`,
    messages: [
      {
        role: "user",
        content: `Khách mô tả: "${userQuery}"

Trả về JSON:
{
  "keywords": ["keyword1", "keyword2", ...],
  "priceMin": 0,
  "priceMax": -1,
  "sortBy": "newest",
  "explanation": "AI hiểu: ... (tiếng Việt, 1 câu ngắn)"
}

Lưu ý:
- keywords: 3-6 từ khóa ngắn, tiếng Việt, liên quan tên/mô tả sản phẩm quần áo
- priceMax = -1 nghĩa là không giới hạn
- sortBy: "newest" | "price_asc" | "price_desc"`,
      },
    ],
  });

  let result;
  try {
    const text = response.content[0].text.replace(/```json|```/gi, "").trim();
    result = JSON.parse(text);
  } catch {
    // Fallback: tách từ query làm keyword
    result = {
      keywords: userQuery.split(/\s+/).filter((w) => w.length > 1),
      priceMin: 0,
      priceMax: -1,
      sortBy: "newest",
      explanation: "",
    };
  }

  setCache(cacheKey, result, 3600); // cache 1 giờ
  return result;
}

/**
 * Tìm sản phẩm bằng AI.
 * Dùng $or + $regex trên name, nameEn, description, descriptionEn
 * vì Product model không có field tags/color riêng.
 *
 * @param {Model}  productModel  - import từ product.model.js
 * @param {string} userQuery     - chuỗi mô tả của người dùng
 * @param {number} page
 * @param {number} limit
 */
export async function aiSearchProducts(productModel, userQuery, page = 1, limit = 20) {
  const ai = await extractKeywordsFromQuery(userQuery);

  // Mỗi keyword tạo ra 1 $or condition khớp với bất kỳ text field nào
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

  // Filter giá
  if (ai.priceMin > 0 || ai.priceMax > 0) {
    matchQuery.price = {};
    if (ai.priceMin > 0)  matchQuery.price.$gte = ai.priceMin;
    if (ai.priceMax > 0)  matchQuery.price.$lte = ai.priceMax;
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
    totalPages: Math.ceil(total / limit),
    aiExplanation: ai.explanation,
    fromCache: ai.fromCache || false,
  };
}