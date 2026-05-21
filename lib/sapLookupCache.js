const TTL_MS = 5 * 60 * 1000;
const store = new Map();

export function getLookupCache(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

export function setLookupCache(key, data) {
  store.set(key, { data, expiresAt: Date.now() + TTL_MS });
}

export function clearLookupCache() {
  store.clear();
}

export const LOOKUP_CACHE_TTL_SECONDS = 300;
