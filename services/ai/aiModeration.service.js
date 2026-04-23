import anthropic from "../../utils/anthropic.util.js";

/**
 * Kiểm duyệt 1 review bằng AI.
 *
 * @param {string} comment - Nội dung review
 * @param {number} rating  - Số sao (1-5)
 * @returns {{ status, reason, score }}
 *   status:
 *     "approved"    → tự động duyệt, hiển thị ngay
 *     "need_review" → có dấu hiệu nghi ngờ, đưa vào hàng chờ admin
 *     "rejected"    → vi phạm rõ ràng, từ chối ngay
 */
export async function moderateReview(comment, rating) {
  // Kiểm tra cơ bản trước để tránh tốn API
  if (!comment || comment.trim().length < 5) {
    return { status: "rejected", reason: "Nội dung quá ngắn", score: 0 };
  }
  if (comment.trim().length > 1000) {
    return {
      status: "rejected",
      reason: "Nội dung vượt quá 1000 ký tự",
      score: 0,
    };
  }

  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 200,
    system: `Bạn kiểm duyệt đánh giá sản phẩm quần áo trên sàn TMĐT Việt Nam.
Vi phạm cần phát hiện:
- toxic: chửi bới, ngôn từ xúc phạm, tục tĩu
- spam: quảng cáo, chèn link, nội dung vô nghĩa lặp lại
- fake: không liên quan sản phẩm, nội dung bịa đặt rõ ràng
- hate: kỳ thị, phân biệt đối xử
Chỉ trả JSON, không giải thích.`,
    messages: [
      {
        role: "user",
        content: `Review: "${comment.trim()}"
Số sao: ${rating}/5

Trả về JSON:
{
  "status": "approved" | "need_review" | "rejected",
  "reason": "lý do nếu không approved, để trống nếu approved",
  "score": 0.0
}

Hướng dẫn score: 1.0 = hoàn toàn sạch, 0.0 = vi phạm nặng
Hướng dẫn status:
- approved: bình thường, hữu ích
- need_review: có nghi ngờ nhưng chưa chắc → để admin xem
- rejected: vi phạm rõ ràng`,
      },
    ],
  });

  try {
    const text = response.content[0].text.replace(/```json|```/gi, "").trim();
    return JSON.parse(text);
  } catch {
    return {
      status: "need_review",
      reason: "Không thể phân tích tự động",
      score: 0.5,
    };
  }
}

/**
 * Kiểm duyệt hàng loạt review đang pending — dành cho admin.
 * Dùng Promise.allSettled để 1 lỗi không chặn cả batch.
 *
 * @param {Array<{ id, comment, rating }>} reviews
 */
export async function moderateBatch(reviews) {
  const BATCH_SIZE = 10;
  const results = [];

  for (let i = 0; i < reviews.length; i += BATCH_SIZE) {
    const batch = reviews.slice(i, i + BATCH_SIZE);

    const settled = await Promise.allSettled(
      batch.map((r) => moderateReview(r.comment, r.rating))
    );

    settled.forEach((s, idx) => {
      results.push({
        id: batch[idx].id,
        moderation:
          s.status === "fulfilled"
            ? s.value
            : { status: "need_review", reason: "Lỗi xử lý", score: 0.5 },
      });
    });

    // Delay nhỏ giữa batch để tránh rate limit Anthropic
    if (i + BATCH_SIZE < reviews.length) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return results;
}
