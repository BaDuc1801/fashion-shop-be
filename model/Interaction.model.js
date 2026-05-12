import mongoose from "mongoose";

const SCORE_MAP = {
  view:        1,
  click:       2,
  add_to_cart: 3,
  purchase:    5,
};

const InteractionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "product",
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: ["view", "click", "add_to_cart", "purchase"],
      required: true,
    },
    score: {
      type: Number,
      enum: [1, 2, 3, 5],
      required: true,
    },
    metadata: {
      source: {
        type: String,
        enum: ["organic", "recommendation", "search", "trending"],
        default: "organic",
      },
      session_id: { type: String, default: null },
    },
  },
  { timestamps: true }
);

InteractionSchema.index({ userId: 1, createdAt: -1 });
InteractionSchema.index({ userId: 1, productId: 1 });
InteractionSchema.index({ productId: 1, action: 1 });

InteractionSchema.statics.getScore = (action) => SCORE_MAP[action] ?? 1;

const InteractionModel = mongoose.model("Interaction", InteractionSchema);
InteractionModel.SCORE_MAP = SCORE_MAP;

export default InteractionModel;
export { SCORE_MAP };
