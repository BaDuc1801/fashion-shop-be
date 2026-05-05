export function maskByRanges(text = "", ranges = []) {
  if (!text || !Array.isArray(ranges) || !ranges.length) return text;

  const sorted = ranges
    .map((r) => ({
      start: Number(r[0]),
      end: Number(r[1]),
    }))
    .filter((r) => r.start >= 0 && r.end > r.start)
    .sort((a, b) => a.start - b.start);

  if (!sorted.length) return text;

  let result = "";
  let cursor = 0;

  for (const r of sorted) {
    result += text.slice(cursor, r.start);
    result += "***";
    cursor = r.end;
  }

  result += text.slice(cursor);

  return result;
}
