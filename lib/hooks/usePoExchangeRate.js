'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchSapExchangeRate } from '@/lib/exchangeRateClient.js';
import { requiresPoDocRate } from '@/lib/poCurrency.js';
import { normalizeExchangeRateDate } from '@/lib/poExchangeRateUtils.js';
import { normalizeCurrencyCode } from '@/lib/sap/currencyTokens.js';

/**
 * Load SAP exchange rate when doc currency or document date changes.
 * Exported for unit tests (stale guard, deps).
 */
export async function loadPoExchangeRateForForm(currency, documentDate, options = {}) {
  const code = normalizeCurrencyCode(currency);
  const date = normalizeExchangeRateDate(documentDate);
  if (!code || !date) {
    return { rate: null, aborted: false };
  }
  const data = await fetchSapExchangeRate(code, date, {
    signal: options.signal,
    dedupe: options.dedupe,
  });
  if (options.signal?.aborted) {
    return { rate: null, aborted: true };
  }
  return { rate: data.rate, aborted: false };
}

/**
 * Auto-load read-only DocRate from SAP when foreign/system currency is selected.
 * Depends only on stable primitives: currency code + document date + local currency.
 */
export function usePoExchangeRate(docCurrency, documentDate, localCurrency, setHeader, options = {}) {
  const normalizedCurrency = normalizeCurrencyCode(docCurrency);
  const normalizedDate = normalizeExchangeRateDate(documentDate);
  const needsRate = requiresPoDocRate(normalizedCurrency, localCurrency);

  const [rateLoading, setRateLoading] = useState(false);
  const [rateError, setRateError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  const setHeaderRef = useRef(setHeader);
  const requestIdRef = useRef(0);
  const fetchFnRef = useRef(options.fetchFn ?? loadPoExchangeRateForForm);
  const failedMessageRef = useRef(
    options.failedLoadMessage ||
      'No SAP exchange rate is configured for the selected currency and document date.',
  );
  const loadingMessageRef = useRef(options.loadingMessage || 'Loading exchange rate from SAP...');

  setHeaderRef.current = setHeader;
  fetchFnRef.current = options.fetchFn ?? loadPoExchangeRateForForm;
  failedMessageRef.current =
    options.failedLoadMessage || failedMessageRef.current;
  loadingMessageRef.current = options.loadingMessage || loadingMessageRef.current;

  const applyRateToHeader = useCallback((rateValue) => {
    setHeaderRef.current((prev) => {
      const nextRate = rateValue == null || rateValue === '' ? '' : String(rateValue);
      if (prev.docRate === nextRate) return prev;
      return { ...prev, docRate: nextRate };
    });
  }, []);

  useEffect(() => {
    if (!needsRate || !normalizedCurrency || !normalizedDate) {
      setRateLoading(false);
      setRateError('');
      applyRateToHeader('');
      return undefined;
    }

    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    setRateLoading(true);
    setRateError('');

    fetchFnRef
      .current(normalizedCurrency, normalizedDate, { signal: controller.signal })
      .then(({ rate, aborted }) => {
        if (aborted || requestId !== requestIdRef.current) return;
        if (rate == null || rate <= 0) {
          setRateError(failedMessageRef.current);
          applyRateToHeader('');
          return;
        }
        applyRateToHeader(rate);
        setRateError('');
      })
      .catch((err) => {
        if (controller.signal.aborted || requestId !== requestIdRef.current) return;
        setRateError(err.message || failedMessageRef.current);
        applyRateToHeader('');
      })
      .finally(() => {
        if (!controller.signal.aborted && requestId === requestIdRef.current) {
          setRateLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [applyRateToHeader, needsRate, normalizedCurrency, normalizedDate, reloadToken]);

  const reloadRate = useCallback(() => {
    setReloadToken((n) => n + 1);
  }, []);

  return {
    rateLoading: needsRate ? rateLoading : false,
    rateError: needsRate ? rateError : '',
    needsRate,
    loadingMessage: loadingMessageRef.current,
    reloadRate,
  };
}
