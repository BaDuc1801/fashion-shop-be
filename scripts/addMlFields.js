import "dotenv/config";
import mongoose from "mongoose";
 
const MONGO_URI = process.env.MONGOCONNECT
 
async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Kết nối MongoDB");
 
  const db = mongoose.connection.db;
 
  const userResult = await db.collection("users").updateMany(
    { ml_user_id: { $exists: false } },
    { $set: { ml_user_id: null, has_ml_profile: false } }
  );
  console.log(`Users updated: ${userResult.modifiedCount}`);
 
  const productResult = await db.collection("products").updateMany(
    { ml_product_id: { $exists: false } },
    { $set: { ml_product_id: null, hm_article_id: null } }
  );
  console.log(`Products ml fields updated: ${productResult.modifiedCount}`);
 
  const statsResult = await db.collection("products").updateMany(
    { stats: { $exists: false } },
    {
      $set: {
        stats: {
          view_count:        0,
          click_count:       0,
          add_to_cart_count: 0,
          purchase_count:    0,
        },
      },
    }
  );
  console.log(`Products stats added: ${statsResult.modifiedCount}`);
 
  console.log("\nMigration hoàn tất!");
  await mongoose.disconnect();
}
 
run().catch((err) => {
  console.error("❌ Migration lỗi:", err);
  process.exit(1);
});