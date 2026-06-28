'use client';

import { useEffect, useRef, useState } from 'react';
import { mergeHeaderWithVendorCurrency } from '@/lib/poCurrency.js';
import { fetchVendorCurrencyConfig } from '@/lib/vendorCurrencyClient.js';

const vendorCurrencyConfigCache = new Map();

export function clearVendorCurrencyConfigCache() {
  vendorCurrencyConfigCache.clear();
}

export function getVendorCurrencyConfigCache() {
  return vendorCurrencyConfigCache;
}

function isCacheableVendorCurrencyConfig(config) {
  return Boolean(
    config &&
      !config.error &&
      (config.currencyMode === 'single' || config.allowedCurrencies?.length),
  );
}

/**
 * Load vendor currency config for PO forms.
 * Exported for unit tests (fetch dedupe, cache, stale guard).
 */
export async function loadVendorCurrencyConfigForForm(vendorCode, options = {}) {
  const code = String(vendorCode || '').trim();
  if (!code) {
    return { config: null, fromCache: false, aborted: false };
  }

  const cache = options.cache ?? vendorCurrencyConfigCache;
  const fetchFn = options.fetchFn ?? fetchVendorCurrencyConfig;

  if (cache.has(code)) {
    return { config: cache.get(code), fromCache: true, aborted: false };
  }

  const config = await fetchFn(code, { signal: options.signal });
  if (options.signal?.aborted) {
    return { config: null, fromCache: false, aborted: true };
  }

  if (isCacheableVendorCurrencyConfig(config)) {
    cache.set(code, config);
  }

  return { config, fromCache: false, aborted: false };
}

/**
 * Fetch vendor currencies when vendorCode changes; apply defaults in a separate effect.
 * Does not depend on parent callback identity or unrelated header fields.
 */
export function useVendorCurrencyConfig(vendorCode, setHeader, options = {}) {
  const normalizedVendorCode = String(vendorCode || '').trim();
  const [vendorCurrencyConfig, setVendorCurrencyConfig] = useState(null);
  const [currencyLoading, setCurrencyLoading] = useState(false);
  const [currencyError, setCurrencyError] = useState('');

  const setHeaderRef = useRef(setHeader);
  const requestIdRef = useRef(0);
  const fetchFnRef = useRef(options.fetchFn ?? fetchVendorCurrencyConfig);
  const cacheRef = useRef(options.cache ?? vendorCurrencyConfigCache);
  const failedMessageRef = useRef(
    options.failedLoadMessage || 'Failed to load Vendor currencies from SAP.',
  );

  setHeaderRef.current = setHeader;
  fetchFnRef.current = options.fetchFn ?? fetchVendorCurrencyConfig;
  cacheRef.current = options.cache ?? vendorCurrencyConfigCache;
  failedMessageRef.current =
    options.failedLoadMessage || failedMessageRef.current;

  useEffect(() => {
    if (!normalizedVendorCode) {
      setVendorCurrencyConfig(null);
      setCurrencyLoading(false);
      setCurrencyError('');
      return undefined;
    }

    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    setCurrencyLoading(true);
    setCurrencyError('');

    loadVendorCurrencyConfigForForm(normalizedVendorCode, {
      signal: controller.signal,
      cache: cacheRef.current,
      fetchFn: fetchFnRef.current,
    })
      .then(({ config, aborted }) => {
        if (aborted || requestId !== requestIdRef.current) return;
        setVendorCurrencyConfig(config);
      })
      .catch((err) => {
        if (controller.signal.aborted || requestId !== requestIdRef.current) return;
        setVendorCurrencyConfig(null);
        setCurrencyError(err.message || failedMessageRef.current);
      })
      .finally(() => {
        if (!controller.signal.aborted && requestId === requestIdRef.current) {
          setCurrencyLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [normalizedVendorCode]);

  useEffect(() => {
    if (!normalizedVendorCode || !vendorCurrencyConfig) return;

    setHeaderRef.current((prev) => {
      if (String(prev?.vendor || '').trim() !== normalizedVendorCode) return prev;
      return mergeHeaderWithVendorCurrency(prev, vendorCurrencyConfig);
    });
  }, [vendorCurrencyConfig, normalizedVendorCode]);

  return {
    vendorCurrencyConfig,
    currencyLoading,
    currencyError,
  };
}
