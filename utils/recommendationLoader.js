import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REC_FILE_PATH = path.join(__dirname, "../data/recommendations.json");

let _cache = null;
let _cacheLoadedAt = null;
const CACHE_TTL_MS = 60 * 60 * 1000;

function loadRecommendations() {
  const now = Date.now();
  if (_cache && _cacheLoadedAt && now - _cacheLoadedAt < CACHE_TTL_MS) {
    return _cache;
  }

  try {
    const raw = fs.readFileSync(REC_FILE_PATH, "utf-8");
    const data = JSON.parse(raw);
    delete data["_meta"];
    _cache = data;
    _cacheLoadedAt = now;
    console.log(`[RecommendationLoader] Loaded ${Object.keys(data).length} user recommendations`);
    return _cache;
  } catch (err) {
    console.error("[RecommendationLoader] Lỗi đọc file recommendations.json:", err.message);
    return {};
  }
}

function getRecommendedProductIds(mlUserId) {
  const recs = loadRecommendations();
  return recs[String(mlUserId)] || [];
}

function invalidateCache() {
  _cache = null;
  _cacheLoadedAt = null;
  console.log("[RecommendationLoader] Cache đã được xóa, sẽ reload lần sau");
}

export { loadRecommendations, getRecommendedProductIds, invalidateCache };
