// scripts/syncRecommendations.js
// Chạy: node scripts/syncRecommendations.js
// Đặt recommendations.json, item_matrix.json, id_mapping.json vào scripts/ trước khi chạy

import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const MONGO_URI = process.env.MONGOCONNECT

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("✅ MongoDB connected");

  // Copy recommendations.json + item_matrix.json vào data/
  const dataDir = path.join(__dirname, "../data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  fs.copyFileSync(
    path.join(__dirname, "recommendations.json"),
    path.join(dataDir, "recommendations.json")
  );
  fs.copyFileSync(
    path.join(__dirname, "item_matrix.json"),
    path.join(dataDir, "item_matrix.json")
  );
  console.log("✅ Copied recommendations.json + item_matrix.json → data/");

  console.log("ℹ️  User mapping: bỏ qua ở lần đầu (chưa có interaction thực)");
  console.log("   has_ml_profile sẽ được cập nhật sau lần retrain đầu tiên");

  console.log("\n✅ Sync hoàn tất!");
  await mongoose.disconnect();
}

run().catch(err => {
  console.error("❌ Lỗi:", err.message);
  process.exit(1);
});
