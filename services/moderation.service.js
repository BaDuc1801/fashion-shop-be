import client from "../config/openAI.js";

export async function checkToxicComment(comment) {
  try {
    const response = await client.responses.create({
      model: "gpt-5-mini",
      input: `
Bạn là hệ thống kiểm duyệt nội dung.

Hãy kiểm tra comment sau có chứa:
- toxic (chửi bậy, xúc phạm, công kích cá nhân)
- ngôn từ thù ghét

Chỉ trả về JSON đúng format:

{
  "toxic": true/false,
  "reason": "ngắn gọn lý do",
  "reasonEn": "short reason in English"
}

Comment: """${comment}"""
      `,
    });

    const text = response.output_text;

    return JSON.parse(text);
  } catch (err) {
    console.error("checkToxicComment error:", err);
    return {
      toxic: false,
      reason: "error parsing or API failure",
      reasonEn: "error parsing or API failure",
    };
  }
}
