'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';
import {
  getPortalDocument,
  invalidatePortalDocument,
  primePortalDocument,
} from '@/lib/documentClientCache';

const DOC_API = {
  PR: '/api/purchase-requests',
  PO: '/api/purchase-orders',
  APRI: '/api/ap-reserve-invoices',
};

const inFlight = new Map();

function docKey(kind, id) {
  return `${kind}:${id}`;
}

function logDocumentFetch(source, cacheHit = false) {
  if (process.env.NODE_ENV !== 'development') return;
  if (cacheHit) {
    console.log('[fetch] document source:', source, '(cache hit)');
    return;
  }
  console.log('[fetch] document source:', source);
}

/**
 * Shared document loader — one in-flight GET per kind/id, persistent memory cache.
 */
export async function fetchPortalDocument(kind, id, source) {
  const cached = getPortalDocument(kind, id);
  if (cached) {
    logDocumentFetch(source, true);
    return cached;
  }

  const key = docKey(kind, id);
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
      primePortalDocument(kind, id, json.data);
      return json.data;
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
  const [doc, setDoc] = useState(() => getPortalDocument(kind, id));
  const [loading, setLoading] = useState(() => !getPortalDocument(kind, id));
  const [error, setError] = useState('');
  const sourceRef = useRef(source);
  sourceRef.current = source;

  useEffect(() => {
    let cancelled = false;
    const cached = getPortalDocument(kind, id);
    if (cached) {
      setDoc(cached);
      setLoading(false);
      setError('');
      return undefined;
    }

    setLoading(true);
    setError('');

    fetchPortalDocument(kind, id, sourceRef.current)
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
  }, [kind, id]);

  const setDocument = useCallback(
    (next) => {
      if (!next) return;
      primePortalDocument(kind, id, next);
      setDoc(next);
    },
    [kind, id],
  );

  const refresh = useCallback(async () => {
    invalidatePortalDocument(kind, id);
    inFlight.delete(docKey(kind, id));
    setLoading(true);
    setError('');
    try {
      const data = await fetchPortalDocument(kind, id, `${sourceRef.current}:refresh`);
      setDoc(data);
    } catch (err) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [kind, id]);

  return { doc, loading, error, setDocument, refresh };
}
