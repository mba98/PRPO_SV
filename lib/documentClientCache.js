'use client';

const PREFIX = 'portal-doc:';

function storageKey(kind, id) {
  return `${PREFIX}${kind}:${id}`;
}

export function cachePortalDocument(kind, id, document) {
  if (typeof window === 'undefined' || !kind || !id || !document) return;
  try {
    sessionStorage.setItem(storageKey(kind, id), JSON.stringify(document));
  } catch {
    // ignore quota / private mode
  }
}

export function readPortalDocument(kind, id) {
  if (typeof window === 'undefined' || !kind || !id) return null;
  try {
    const raw = sessionStorage.getItem(storageKey(kind, id));
    if (!raw) return null;
    sessionStorage.removeItem(storageKey(kind, id));
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function peekPortalDocument(kind, id) {
  if (typeof window === 'undefined' || !kind || !id) return null;
  try {
    const raw = sessionStorage.getItem(storageKey(kind, id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
