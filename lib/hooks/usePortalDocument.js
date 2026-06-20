'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';
import {
  getPortalDocument,
  invalidatePortalDocument,
  isStalePortalDocument,
  pickNewerPortalDocument,
  portalDocumentVersion,
  primePortalDocument,
  shouldBypassPortalDocumentCache,
} from '@/lib/documentClientCache';
import { useAuthStore } from '@/stores/authStore';

const DOC_API = {
  PR: '/api/purchase-requests',
  PO: '/api/purchase-orders',
  APRI: '/api/ap-reserve-invoices',
  LOCAL_PURCHASE: '/api/local-purchases',
};

const inFlight = new Map();

function docKey(kind, id, userId) {
  return `${userId || '_anon'}:${kind}:${id}`;
}

function logDocumentFetch(source, cacheHit = false) {
  if (process.env.NODE_ENV !== 'development') return;
  if (cacheHit) {
    console.log('[fetch] document source:', source, '(cache hit)');
    return;
  }
  console.log('[fetch] document source:', source);
}

function logLocalPurchaseDetailState(cachedDocument, apiDocument, renderedDocument) {
  if (process.env.NODE_ENV !== 'development') return;
  console.log('Local Purchase detail state', {
    id: renderedDocument?.id || renderedDocument?._id,
    portalLPNumber: renderedDocument?.portalLPNumber,
    apiStatus: apiDocument?.status,
    cachedStatus: cachedDocument?.status,
    renderedStatus: renderedDocument?.status,
    apiVersion: apiDocument?.__v,
    cachedVersion: cachedDocument?.__v,
    currentApprovalStep: renderedDocument?.currentApprovalStep,
    completedAt: renderedDocument?.completedAt,
  });
}

function resolvePortalDocument(kind, cachedDocument, apiDocument) {
  const resolved = pickNewerPortalDocument(cachedDocument, apiDocument) || apiDocument;
  if (kind === 'LOCAL_PURCHASE') {
    logLocalPurchaseDetailState(cachedDocument, apiDocument, resolved);
  }
  return resolved;
}

/**
 * Shared document loader — one in-flight GET per viewer/kind/id, user-scoped cache.
 */
export async function fetchPortalDocument(kind, id, source, userId) {
  const cached = getPortalDocument(kind, id, userId);
  const bypassCache = shouldBypassPortalDocumentCache(kind, cached);

  if (cached && !bypassCache && !isStalePortalDocument(kind, cached)) {
    logDocumentFetch(source, true);
    return cached;
  }

  const key = docKey(kind, id, userId);
  if (inFlight.has(key)) {
    return inFlight.get(key);
  }

  const base = DOC_API[kind];
  if (!base) {
    throw new Error(`Unknown document kind: ${kind}`);
  }

  logDocumentFetch(source);

  const promise = apiFetch(`${base}/${id}`, {
    source: `document:${source}`,
    dedupe: true,
  })
    .then(({ json }) => {
      if (!json.success) {
        throw new Error(json.message || 'Failed to load document');
      }
      const resolved = resolvePortalDocument(kind, cached, json.data);
      primePortalDocument(kind, id, resolved, userId);
      return resolved;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}

/**
 * Page-level document state shared across approve/detail navigation.
 */
export function usePortalDocument(kind, id, source) {
  const userId = useAuthStore((s) => s.user?.id);
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const sourceRef = useRef(source);
  sourceRef.current = source;

  useEffect(() => {
    if (!userId) return undefined;

    let cancelled = false;
    const cached = getPortalDocument(kind, id, userId);
    const canRenderCachedWhileLoading =
      cached &&
      !shouldBypassPortalDocumentCache(kind, cached) &&
      !isStalePortalDocument(kind, cached);

    if (canRenderCachedWhileLoading) {
      setDoc(cached);
      setLoading(false);
      setError('');
      return undefined;
    }

    if (cached && portalDocumentVersion(cached) >= 0) {
      setDoc(cached);
    }

    setLoading(true);
    setError('');

    fetchPortalDocument(kind, id, sourceRef.current, userId)
      .then((data) => {
        if (!cancelled) {
          setDoc(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [kind, id, userId]);

  const setDocument = useCallback(
    (next) => {
      if (!next || !userId) return;
      const cached = getPortalDocument(kind, id, userId);
      const resolved = resolvePortalDocument(kind, cached, next);
      primePortalDocument(kind, id, resolved, userId);
      setDoc(resolved);
    },
    [kind, id, userId],
  );

  const refresh = useCallback(async () => {
    if (!userId) return;
    invalidatePortalDocument(kind, id, userId);
    inFlight.delete(docKey(kind, id, userId));
    setLoading(true);
    setError('');
    try {
      const data = await fetchPortalDocument(kind, id, `${sourceRef.current}:refresh`, userId);
      setDoc(data);
    } catch (err) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [kind, id, userId]);

  return { doc, loading: loading || !userId, error, setDocument, refresh };
}
