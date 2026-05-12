import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
 
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
 
const ITEM_MATRIX_PATH = path.join(__dirname, "../data/item_matrix.json");
 
let _itemMatrix = null;
 
function loadItemMatrix() {
  if (_itemMatrix) return _itemMatrix;
  const raw = fs.readFileSync(ITEM_MATRIX_PATH, "utf-8");
  _itemMatrix = JSON.parse(raw);
  return _itemMatrix;
}
 
export function invalidateCache() {
  _itemMatrix = null;
}
 
function dot(a, b) {
  return a.reduce((sum, val, i) => sum + val * b[i], 0);
}
 
function norm(v) {
  return Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
}
 
function cosineSimilarity(a, b) {
  const n = norm(a) * norm(b);
  return n === 0 ? 0 : dot(a, b) / n;
}
 
export function computeUserVector(interactions) {
  const matrix = loadItemMatrix();
  const dim    = Object.values(matrix)[0]?.length;
  if (!dim) return null;
 
  const userVec  = new Array(dim).fill(0);
  let totalScore = 0;
 
  for (const { ml_product_id, score } of interactions) {
    const itemVec = matrix[String(ml_product_id)];
    if (!itemVec) continue;
    for (let i = 0; i < dim; i++) {
      userVec[i] += itemVec[i] * score;
    }
    totalScore += score;
  }
 
  if (totalScore === 0) return null;
 
  for (let i = 0; i < dim; i++) {
    userVec[i] /= totalScore;
  }
 
  return userVec;
}
 
/**
 * @param {number[]} userVector
 * @param {number[]} excludeMlIds  
 * @param {number}   topN
 * @param {number[]|null} allowedIds 
 */
export function findTopNByUserVector(userVector, excludeMlIds = [], topN = 20, allowedIds = null) {
  const matrix     = loadItemMatrix();
  const excludeSet = new Set(excludeMlIds.map(String));
  const allowSet   = allowedIds ? new Set(allowedIds.map(String)) : null;
 
  const scored = Object.entries(matrix)
    .filter(([id]) => !excludeSet.has(id))
    .filter(([id]) => !allowSet || allowSet.has(id)) 
    .map(([id, vec]) => ({
      ml_product_id: parseInt(id),
      score: cosineSimilarity(userVector, vec),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
 
  return scored;
}