import Interaction from "../model/Interaction.model.js";
import productModel from "../model/product.model.js";

const SCORE_MAP = Interaction.SCORE_MAP;
async function saveInteraction(userId, productId, action, metadata = {}) {
  const score = SCORE_MAP[action];

  const [interaction] = await Promise.all([
    Interaction.create({ userId, productId, action, score, metadata }),
    productModel.findByIdAndUpdate(productId, {
      $inc: { [`stats.${action}_count`]: 1 },
    }),
  ]);

  return interaction;
}

export const trackView = async (req, res) => {
  console.log("req.user:", req.user);
  try {
    const { productId, source } = req.body;
    if (!productId) return res.status(400).json({ success: false, message: "productId là bắt buộc" });

    await saveInteraction(req.user.id, productId, "view", {
      source: source || "organic",
      session_id: req.headers["x-session-id"] || null,
    });
    res.status(201).json({ success: true, score: 1 });
  } catch (err) {
    console.error("[trackView]", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const trackClick = async (req, res) => {
  try {
    const { productId, source } = req.body;
    if (!productId) return res.status(400).json({ success: false, message: "productId là bắt buộc" });

    await saveInteraction(req.user.id, productId, "click", {
      source: source || "organic",
      session_id: req.headers["x-session-id"] || null,
    });
    res.status(201).json({ success: true, score: 2 });
  } catch (err) {
    console.error("[trackClick]", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const trackAddToCart = async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ success: false, message: "productId là bắt buộc" });

    await saveInteraction(req.user.id, productId, "add_to_cart", {
      session_id: req.headers["x-session-id"] || null,
    });
    res.status(201).json({ success: true, score: 3 });
  } catch (err) {
    console.error("[trackAddToCart]", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const trackPurchase = async (req, res) => {
  try {
    const { productIds } = req.body;
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ success: false, message: "productIds phải là mảng không rỗng" });
    }

    await Promise.all(
      productIds.map((pid) =>
        saveInteraction(req.user.id, pid, "purchase", {
          session_id: req.headers["x-session-id"] || null,
        })
      )
    );
    res.status(201).json({ success: true, count: productIds.length, score: 5 });
  } catch (err) {
    console.error("[trackPurchase]", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};
