const store = new Map();

export function getCache(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache(key, data, ttlSeconds = 3600) {
  store.set(key, { data, expiry: Date.now() + ttlSeconds * 1000 });
}

export function deleteCache(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}