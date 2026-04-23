import { callAI } from "../../utils/gemini.util.js";

function fallbackModerate(comment) {
  const toxic = ["đmm", "vcl", "shit", "địt", "fuck", "dm ", "vl ", "cứt", "ngu", "óc chó"];
  const spam  = ["http://", "https://", "www.", ".com", "shopee", "lazada", "tiki", "sendo"];
  const lower = comment.toLowerCase();

  if (toxic.some((w) => lower.includes(w)))
    return { status: "rejected", reason: "Nội dung chứa ngôn từ không phù hợp", score: 0, isFallback: true };
  if (spam.some((w) => lower.includes(w)))
    return { status: "need_review", reason: "Có thể chứa spam hoặc quảng cáo", score: 0.3, isFallback: true };
  return { status: "approved", reason: "", score: 1, isFallback: true };
}

export async function moderateReview(comment, rating) {
  if (!comment || comment.trim().length < 5)
    return { status: "rejected", reason: "Nội dung quá ngắn", score: 0 };
  if (comment.trim().length > 1000)
    return { status: "rejected", reason: "Nội dung vượt quá 1000 ký tự", score: 0 };

  if (!process.env.GEMINI_API_KEY) return fallbackModerate(comment);

  try {
    const text = await callAI(
      `Bạn kiểm duyệt đánh giá sản phẩm quần áo trên sàn TMĐT Việt Nam.
Vi phạm: toxic (chửi bới/tục tĩu), spam (quảng cáo/link), fake (bịa đặt), hate (kỳ thị).
Chỉ trả JSON thuần, không markdown.`,
      `Review: "${comment.trim()}"
Số sao: ${rating}/5

Trả về JSON:
{
  "status": "approved",
  "reason": "",
  "score": 0.0
}

status chỉ được là: "approved" | "need_review" | "rejected"
score: 1.0 = hoàn toàn sạch, 0.0 = vi phạm nặng`,
      150
    );

    const clean = text.replace(/```json|```/gi, "").trim();
    return JSON.parse(clean);

  } catch (err) {
    console.warn("[AI Moderation] Gemini lỗi, dùng fallback:", err.message);
    return fallbackModerate(comment);
  }
}

export async function moderateBatch(reviews) {
  const results = [];
  for (let i = 0; i < reviews.length; i += 10) {
    const batch = reviews.slice(i, i + 10);
    const settled = await Promise.allSettled(
      batch.map((r) => moderateReview(r.comment, r.rating))
    );
    settled.forEach((s, idx) => {
      results.push({
        id: batch[idx].id,
        moderation: s.status === "fulfilled"
          ? s.value
          : { status: "need_review", reason: "Lỗi xử lý", score: 0.5 },
      });
    });
    if (i + 10 < reviews.length) await new Promise((r) => setTimeout(r, 300));
  }
  return results;
}
