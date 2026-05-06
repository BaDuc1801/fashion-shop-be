import client from "../config/openAI.js";
import productModel from "../model/product.model.js";

export async function recommendProducts(prompt) {
  const products = await productModel
    .find({ status: "active", stock: { $gt: 0 } })
    .populate("categoryId")
    .select("nameEn descriptionEn price categoryId")
    .limit(100)
    .lean();

  const productText = products
    .map(
      (p) => `
id: ${p._id}
name: ${p.nameEn}
description: ${p.descriptionEn}
price: ${p.price}
category: ${p.categoryId.name}
`
    )
    .join("\n");

  const response = await client.responses.create({
    model: "gpt-5-mini",
    input: `
Bạn là AI tư vấn mua sắm.

Chọn sản phẩm phù hợp với yêu cầu user, đúng giới tính nếu họ có đề xuất (check từ category) và bối cảnh nếu họ có đề xuất.

Nếu user KHÔNG CỤ THỂ hoặc muốn "tất cả": không có gender / context / season rõ ràng

→ CHỈ trả tối đa 8 sản phẩm

Chỉ trả JSON:
{
  "productIds": ["id1", "id2"],
}

User: "${prompt}"

Products:
${productText}
`,
  });

  let data;
  try {
    data = JSON.parse(response.output_text);
  } catch {
    return { productIds: [] };
  }

  return data;
}
