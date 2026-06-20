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

/** APRI detail payloads must include server-computed action flags (cache schema v2). */
export function apriDocumentHasActionFlags(document) {
  if (!document) return false;
  return (
    typeof document.canCreateInSap === 'boolean' &&
    typeof document.canEditQuantities === 'boolean' &&
    typeof document.canRetrySap === 'boolean'
  );
}

/** LP detail payloads must include version + server-computed action/workflow flags. */
export function lpDocumentHasDetailFlags(document) {
  if (!document) return false;
  return (
    typeof document.__v === 'number' &&
    typeof document.canApproveCurrentStep === 'boolean' &&
    Array.isArray(document.workflowSteps)
  );
}

export function portalDocumentVersion(document) {
  if (document?.__v == null) return -1;
  const version = Number(document.__v);
  return Number.isFinite(version) ? version : -1;
}

export function portalDocumentTime(document) {
  const value = document?.updatedAt || document?.completedAt;
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/** Prefer the document with the higher __v; tie-break on updatedAt/completedAt. */
export function pickNewerPortalDocument(cached, fresh) {
  if (!fresh) return cached ?? null;
  if (!cached) return fresh;
  const cachedVersion = portalDocumentVersion(cached);
  const freshVersion = portalDocumentVersion(fresh);
  if (freshVersion > cachedVersion) return fresh;
  if (cachedVersion > freshVersion) return cached;
  return portalDocumentTime(fresh) >= portalDocumentTime(cached) ? fresh : cached;
}

export function isStalePortalDocument(kind, document) {
  if (!document) return true;
  if (kind === 'APRI') {
    return !apriDocumentHasActionFlags(document);
  }
  if (kind === 'LOCAL_PURCHASE') {
    return !lpDocumentHasDetailFlags(document);
  }
  return false;
}

export function shouldBypassPortalDocumentCache(kind, document) {
  if (kind === 'LOCAL_PURCHASE') return true;
  return isStalePortalDocument(kind, document);
}

/** Read cached document without removing it. */
export function getPortalDocument(kind, id, userId) {
  if (!kind || !id) return null;
  const key = memoryKey(kind, id, userId);
  if (memory.has(key)) {
    const cached = memory.get(key);
    if (isStalePortalDocument(kind, cached)) {
      invalidatePortalDocument(kind, id, userId);
      return null;
    }
    return cached;
  }
  const fromStorage = peekPortalDocument(kind, id, userId);
  if (fromStorage && isStalePortalDocument(kind, fromStorage)) {
    invalidatePortalDocument(kind, id, userId);
    return null;
  }
  return fromStorage;
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
