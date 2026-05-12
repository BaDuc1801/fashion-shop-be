// scripts/seedHMProducts.js
// Chạy: node scripts/seedHMProducts.js
// Đặt products_seed.csv vào thư mục scripts/ trước khi chạy

import "dotenv/config";
import mongoose from "mongoose";
import csv from "csv-parser";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const MONGO_URI = process.env.MONGOCONNECT
const CSV_PATH  = path.join(__dirname, "products_seed.csv");

const TARGETS = {
  men: 13, women: 13, kids: 13, shoes: 13,
  bags: 12, accessories: 12, sportswear: 12, essentials: 12,
};

const CATEGORY_RULES = [
  { slug: "shoes",       match: r => ["Shoes", "Footwear"].includes(r.product_group_name) },
  { slug: "bags",        match: r => ["Bags", "Handbag"].includes(r.product_group_name) },
  { slug: "accessories", match: r => ["Accessories","Jewellery","Belts","Hats & Scarfs","Socks & Tights","Ties","Eyewear"].includes(r.product_group_name) },
  { slug: "sportswear",  match: r => r.index_group_name === "Sport" || ["Sport","Sportswear","Outdoor"].includes(r.product_group_name) },
  { slug: "kids",        match: r => r.index_group_name?.startsWith("Kids") || r.index_group_name === "Baby Sizes 50-98" },
  { slug: "men",         match: r => r.index_group_name === "Menswear" },
  { slug: "women",       match: r => ["Ladieswear", "Divided"].includes(r.index_group_name) },
  { slug: "essentials",  match: () => true },
];

const COLOR_HEX_MAP = {
  "Black": "#000000", "White": "#FFFFFF", "Grey":  "#808080",
  "Blue":  "#3B82F6", "Navy Blue": "#1E3A5F", "Red": "#EF4444",
  "Pink":  "#EC4899", "Green": "#22C55E",  "Yellow": "#EAB308",
  "Orange":"#F97316", "Brown": "#92400E",  "Beige": "#D4B896",
  "Purple":"#A855F7", "Khaki green": "#6B7A3E", "Mole": "#9B8E82",
};

const UNSPLASH = {
  men:         ["photo-1521572163474-6864f9cf17ab","photo-1489987707025-afc232f7ea0f","photo-1506629082955-511b1aa562c8"],
  women:       ["photo-1494790108377-be9c29b29330","photo-1469334031218-e382a71b716b","photo-1515886657613-9f3515b0c78f"],
  kids:        ["photo-1622290291468-a28f7a7dc6a8","photo-1471286174890-9c112ac6823b","photo-1503944583220-79d8926ad5e2"],
  shoes:       ["photo-1542291026-7eec264c27ff","photo-1606107557195-0e29a4b5b4aa","photo-1491553895911-0055eca6402d"],
  bags:        ["photo-1548036328-c9fa89d128fa","photo-1566150905458-1bf1fc113f0d","photo-1553062407-98eeb64c6a62"],
  accessories: ["photo-1523293182086-7651a899d37f","photo-1509941943102-10c232535736","photo-1611923134239-b9be5816d88e"],
  sportswear:  ["photo-1571019613454-1cb2f99b2d8b","photo-1518611012118-696072aa579a","photo-1556906781-9a412961a28c"],
  essentials:  ["photo-1516762689617-e1cffcef479d","photo-1503341504253-dff4815485f1","photo-1520975916090-3105956dac38"],
};

function getImages(slug) {
  return (UNSPLASH[slug] || UNSPLASH.essentials)
    .map(id => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`);
}

function randomPrice(slug) {
  const ranges = {
    shoes: [30, 120], bags: [25, 150],
    accessories: [10, 60], sportswear: [20, 100],
  };
  const [min, max] = ranges[slug] || [15, 80];
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildVariants(colourGroupName, slug) {
  const hex   = COLOR_HEX_MAP[colourGroupName] || "#CCCCCC";
  const sizes = slug === "shoes" ? ["38","39","40","41","42"] : ["S","M","L","XL"];
  return [{
    color:  hex,
    images: getImages(slug),
    skus:   sizes.map(size => ({
      size,
      quantity: Math.floor(Math.random() * 20) + 5,
      reserved: 0,
      sold:     0,
    })),
  }];
}

function detectSlug(row) {
  for (const rule of CATEGORY_RULES) {
    if (rule.match(row)) return rule.slug;
  }
  return "essentials";
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("✅ MongoDB connected\n");

  const db = mongoose.connection.db;

  // Load categories theo slug
  const categories  = await db.collection("categories")
    .find({ slug: { $in: Object.keys(TARGETS) } })
    .toArray();
  const categoryMap = new Map(categories.map(c => [c.slug, c._id]));

  const missing = Object.keys(TARGETS).filter(s => !categoryMap.has(s));
  if (missing.length) {
    console.error("❌ Không tìm thấy category với slug:", missing);
    process.exit(1);
  }

  // Đọc CSV
  const allRows = [];
  await new Promise((resolve, reject) => {
    fs.createReadStream(CSV_PATH)
      .pipe(csv())
      .on("data", row => allRows.push(row))
      .on("end", resolve)
      .on("error", reject);
  });
  console.log(`📊 CSV: ${allRows.length.toLocaleString()} sản phẩm\n`);

  // Phân loại vào bucket
  const buckets = Object.fromEntries(Object.keys(TARGETS).map(s => [s, []]));
  for (const row of allRows) {
    const slug = detectSlug(row);
    if (buckets[slug].length < TARGETS[slug]) {
      buckets[slug].push(row);
    }
    if (Object.entries(buckets).every(([s, b]) => b.length >= TARGETS[s])) break;
  }

  // Build documents
  const docs = [];
  for (const [slug, rows] of Object.entries(buckets)) {
    for (const row of rows) {
      const mlId    = parseInt(row.ml_product_id);
      const price   = randomPrice(slug);
      const stock   = Math.floor(Math.random() * 80) + 20;
      const desc    = (row.detail_desc || row.prod_name || "").trim();
      const variants = buildVariants(row.colour_group_name, slug);
      const variantStock = variants.reduce(
        (t, v) => t + v.skus.reduce((s, k) => s + k.quantity, 0), 0
      );

      docs.push({
        name:          row.prod_name,
        nameEn:        row.prod_name,
        description:   desc,
        descriptionEn: desc,
        sku:           `HM-${row.article_id}`,
        price,
        stock:         variantStock,
        status:        "active",
        categoryId:    categoryMap.get(slug),
        ml_product_id: isNaN(mlId) ? null : mlId,
        hm_article_id: row.article_id,
        variants,
        stats: { view_count: 0, click_count: 0, add_to_cart_count: 0, purchase_count: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  // Xóa H&M cũ rồi insert mới
  const deleted = await db.collection("products").deleteMany({ hm_article_id: { $exists: true } });
  if (deleted.deletedCount) console.log(`🗑️  Đã xóa ${deleted.deletedCount} sản phẩm H&M cũ\n`);

  await db.collection("products").insertMany(docs);

  // Log kết quả
  console.log("📦 Kết quả seed:");
  let total = 0;
  for (const [slug, rows] of Object.entries(buckets)) {
    console.log(`   ${slug.padEnd(15)} ${rows.length} sản phẩm`);
    total += rows.length;
  }
  console.log(`   ${"─".repeat(25)}`);
  console.log(`   ${"TỔNG".padEnd(15)} ${total} sản phẩm`);
  console.log("\n✅ Seed hoàn tất!");

  await mongoose.disconnect();
}

run().catch(err => {
  console.error("❌ Lỗi:", err.message);
  process.exit(1);
});
