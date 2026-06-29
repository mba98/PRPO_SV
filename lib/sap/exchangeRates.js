import { normalizeCurrencyCode } from '@/lib/sap/currencyTokens.js';
import { requiresPoDocRate } from '@/lib/poCurrency.js';
import { getCurrencyRateFromServiceLayer } from '@/lib/sapServiceLayer.js';
import { getExchangeRateFromHana } from '@/lib/sapHana.js';
import {
  buildExchangeRateCacheKey,
  normalizeExchangeRateDate,
} from '@/lib/poExchangeRateUtils.js';

export const SAP_EXCHANGE_RATE_NOT_FOUND_CODE = 'SAP_EXCHANGE_RATE_NOT_FOUND';

export const SAP_EXCHANGE_RATE_NOT_FOUND_MESSAGE =
  'No SAP exchange rate is configured for the selected currency and document date.';

const CACHE_TTL_MS = 60 * 1000;
const rateCache = new Map();

export { normalizeExchangeRateDate, buildExchangeRateCacheKey } from '@/lib/poExchangeRateUtils.js';

export function clearExchangeRateCache() {
  rateCache.clear();
}

function readCache(key) {
  const entry = rateCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    rateCache.delete(key);
    return null;
  }
  return entry.data;
}

function writeCache(key, data) {
  rateCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

function exchangeRateNotFoundError(currency, date) {
  const err = new Error(SAP_EXCHANGE_RATE_NOT_FOUND_MESSAGE);
  err.code = SAP_EXCHANGE_RATE_NOT_FOUND_CODE;
  err.currency = currency;
  err.date = date;
  return err;
}

function isServiceLayerConfigured() {
  return Boolean(
    process.env.SAP_SL_BASE_URL &&
      process.env.SAP_SL_USERNAME &&
      process.env.SAP_SL_PASSWORD &&
      process.env.SAP_SL_COMPANY_DB,
  );
}

function isHanaConfigured() {
  return Boolean(process.env.HANA_CONNECTION_STRING);
}

/**
 * Load exchange rate from SAP (Service Layer first, HANA ORTT fallback).
 */
export async function getSapExchangeRate(currency, documentDate) {
  const normalizedCurrency = normalizeCurrencyCode(currency);
  const normalizedDate = normalizeExchangeRateDate(documentDate);
  if (!normalizedCurrency || !normalizedDate) {
    throw exchangeRateNotFoundError(currency, documentDate);
  }

  const cacheKey = buildExchangeRateCacheKey(normalizedCurrency, normalizedDate);
  const cached = readCache(cacheKey);
  if (cached) return cached;

  let rate = null;
  let source = 'SAP';

  if (isServiceLayerConfigured()) {
    try {
      rate = await getCurrencyRateFromServiceLayer(normalizedCurrency, normalizedDate);
      if (rate != null) source = 'SAP_SERVICE_LAYER';
    } catch {
      rate = null;
    }
  }

  if (rate == null && isHanaConfigured()) {
    try {
      rate = await getExchangeRateFromHana(normalizedCurrency, normalizedDate);
      if (rate != null) source = 'SAP_HANA_ORTT';
    } catch {
      rate = null;
    }
  }

  if (rate == null) {
    throw exchangeRateNotFoundError(normalizedCurrency, normalizedDate);
  }

  const result = {
    currency: normalizedCurrency,
    date: normalizedDate,
    rate,
    source,
  };
  writeCache(cacheKey, result);
  return result;
}

/**
 * Resolve DocRate for a PO document (undefined for local currency).
 */
export async function resolvePoExchangeRateForDocument({
  currency,
  documentDate,
  localCurrency,
}) {
  if (!requiresPoDocRate(currency, localCurrency)) {
    return { docRate: undefined, source: null };
  }
  const { rate, source } = await getSapExchangeRate(currency, documentDate);
  return { docRate: rate, source };
}
