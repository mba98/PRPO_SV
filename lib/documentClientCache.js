'use client';

const PREFIX = 'portal-doc:';
const memory = new Map();

function storageKey(kind, id) {
  return `${PREFIX}${kind}:${id}`;
}

function memoryKey(kind, id) {
  return `${kind}:${id}`;
}

/** Persist document in memory (+ sessionStorage for tab refresh). */
export function primePortalDocument(kind, id, document) {
  if (!kind || !id || !document) return;
  memory.set(memoryKey(kind, id), document);
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(storageKey(kind, id), JSON.stringify(document));
  } catch {
    // ignore quota / private mode
  }
}

/** @deprecated Use primePortalDocument */
export function cachePortalDocument(kind, id, document) {
  primePortalDocument(kind, id, document);
}

/** Read cached document without removing it. */
export function getPortalDocument(kind, id) {
  if (!kind || !id) return null;
  const key = memoryKey(kind, id);
  if (memory.has(key)) {
    return memory.get(key);
  }
  return peekPortalDocument(kind, id);
}

/** Backward-compatible alias — no longer consumes/removes cache. */
export function readPortalDocument(kind, id) {
  const doc = getPortalDocument(kind, id);
  if (doc) {
    memory.set(memoryKey(kind, id), doc);
  }
  return doc;
}

export function peekPortalDocument(kind, id) {
  if (typeof window === 'undefined' || !kind || !id) return null;
  try {
    const raw = sessionStorage.getItem(storageKey(kind, id));
    if (!raw) return null;
    const doc = JSON.parse(raw);
    memory.set(memoryKey(kind, id), doc);
    return doc;
  } catch {
    return null;
  }
}

export function invalidatePortalDocument(kind, id) {
  if (!kind || !id) return;
  memory.delete(memoryKey(kind, id));
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(storageKey(kind, id));
  } catch {
    // ignore
  }
}
