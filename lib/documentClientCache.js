'use client';

const PREFIX = 'portal-doc:';
const memory = new Map();

function storageKey(kind, id, userId) {
  const viewer = userId || '_anon';
  return `${PREFIX}${viewer}:${kind}:${id}`;
}

function memoryKey(kind, id, userId) {
  const viewer = userId || '_anon';
  return `${viewer}:${kind}:${id}`;
}

/** Persist document in memory (+ sessionStorage for tab refresh). Scoped per viewer user. */
export function primePortalDocument(kind, id, document, userId) {
  if (!kind || !id || !document) return;
  memory.set(memoryKey(kind, id, userId), document);
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(storageKey(kind, id, userId), JSON.stringify(document));
  } catch {
    // ignore quota / private mode
  }
}

/** @deprecated Use primePortalDocument */
export function cachePortalDocument(kind, id, document, userId) {
  primePortalDocument(kind, id, document, userId);
}

/** Read cached document without removing it. */
export function getPortalDocument(kind, id, userId) {
  if (!kind || !id) return null;
  const key = memoryKey(kind, id, userId);
  if (memory.has(key)) {
    return memory.get(key);
  }
  return peekPortalDocument(kind, id, userId);
}

/** Backward-compatible alias — no longer consumes/removes cache. */
export function readPortalDocument(kind, id, userId) {
  const doc = getPortalDocument(kind, id, userId);
  if (doc) {
    memory.set(memoryKey(kind, id, userId), doc);
  }
  return doc;
}

export function peekPortalDocument(kind, id, userId) {
  if (typeof window === 'undefined' || !kind || !id) return null;
  try {
    const raw = sessionStorage.getItem(storageKey(kind, id, userId));
    if (!raw) return null;
    const doc = JSON.parse(raw);
    memory.set(memoryKey(kind, id, userId), doc);
    return doc;
  } catch {
    return null;
  }
}

export function invalidatePortalDocument(kind, id, userId) {
  if (!kind || !id) return;
  memory.delete(memoryKey(kind, id, userId));
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(storageKey(kind, id, userId));
  } catch {
    // ignore
  }
}

export function clearPortalDocumentCache() {
  memory.clear();
  if (typeof window === 'undefined') return;
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(PREFIX)) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {
    // ignore
  }
}
