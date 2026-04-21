import mongoose from "mongoose";

const EventSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["view", "search", "cart", "purchase"],
    required: true,
  },
  // ---event view / cart / purchase ---
  productId:    { type: mongoose.Schema.Types.ObjectId, ref: "product" },
  productName:  { type: String },   
  categoryId:   { type: mongoose.Schema.Types.ObjectId, ref: "category" },
  categoryName: { type: String },   
  price:        { type: Number },

  // ---event search ---
  searchQuery: { type: String },

  createdAt: { type: Date, default: Date.now },
});

const UserBehaviorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      unique: true,
    },
    
    events: { type: [EventSchema], default: [] },
  },
  { timestamps: true }
);

UserBehaviorSchema.index({ userId: 1 });

const userBehaviorModel = mongoose.model("userBehavior", UserBehaviorSchema);
export default userBehaviorModel;