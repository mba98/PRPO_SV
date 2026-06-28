import { getLookupCache, setLookupCache } from '@/lib/sapLookupCache.js';
import { getBusinessPartner } from '@/lib/sapServiceLayer.js';
import { listVendorCurrencyRows, getCompanyLocalCurrency } from '@/lib/sapHana.js';
import { resolveDefaultPoDocCurrency } from '@/lib/sap/sapPoConfig.js';

import {
  isSapAllCurrenciesToken,
  normalizeCurrencyCode,
  SAP_ALL_CURRENCIES_TOKEN,
} from '@/lib/sap/currencyTokens.js';

const BP_CURRENCY_COLLECTION_KEYS = [
  'BPCurrenciesCollection',
  'BPCurrencies',
  'BP_CurrenciesCollection',
];

export function isTruthySapFlag(value) {
  if (value === true || value === 1) return true;
  const v = String(value ?? '')
    .trim()
    .toLowerCase();
  return v === 'y' || v === 'yes' || v === 'tyes' || v === 'true';
}

function pickField(row, ...keys) {
  if (!row || typeof row !== 'object') return undefined;
  for (const key of keys) {
    if (row[key] != null && row[key] !== '') return row[key];
    const upper = key.toUpperCase();
    if (row[upper] != null && row[upper] !== '') return row[upper];
    const lower = key.toLowerCase();
    if (row[lower] != null && row[lower] !== '') return row[lower];
  }
  return undefined;
}

export function extractBpCurrencyCollection(bp) {
  if (!bp || typeof bp !== 'object') return [];
  for (const key of BP_CURRENCY_COLLECTION_KEYS) {
    const raw = bp[key];
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.value)) return raw.value;
  }
  return [];
}

function resolveRawBpCurrency(row) {
  return pickField(row, 'CurrencyCode', 'Currency', 'currency', 'CurrCode');
}

function resolveCurrencyName(code, row) {
  const fromRow = pickField(row, 'CurrencyName', 'CurrName', 'Name', 'currencyName');
  if (fromRow) return String(fromRow).trim();
  return code;
}

function mapIncludedCurrencyRow(row) {
  const code = normalizeCurrencyCode(resolveRawBpCurrency(row));
  if (!code) return null;
  const includeRaw = pickField(row, 'Include', 'Included', 'include');
  if (includeRaw != null && !isTruthySapFlag(includeRaw)) return null;
  const isDefault = isTruthySapFlag(
    pickField(row, 'Default', 'DefaultCurrency', 'IsDefault', 'DefaultCurr', 'default'),
  );
  return {
    code,
    name: resolveCurrencyName(code, row),
    isDefault,
  };
}

function dedupeCurrencyList(entries = []) {
  const byCode = new Map();
  for (const entry of entries) {
    if (!entry?.code) continue;
    const existing = byCode.get(entry.code);
    if (!existing) {
      byCode.set(entry.code, entry);
      continue;
    }
    if (entry.isDefault) {
      byCode.set(entry.code, { ...existing, isDefault: true });
    }
  }
  return [...byCode.values()];
}

function pickDefaultCurrency(allowedCurrencies, explicitDefault, fallback) {
  const allowed = allowedCurrencies.map((c) => c.code);
  const fromExplicit = normalizeCurrencyCode(explicitDefault);
  if (fromExplicit && allowed.includes(fromExplicit)) return fromExplicit;
  const flagged = allowedCurrencies.find((c) => c.isDefault);
  if (flagged) return flagged.code;
  const fb = normalizeCurrencyCode(fallback);
  if (fb && allowed.includes(fb)) return fb;
  return allowed[0] || fb || resolveDefaultPoDocCurrency();
}

/**
 * Normalize Service Layer / HANA vendor currency rows into portal config.
 */
export function normalizeVendorCurrencyConfig({
  vendorCode,
  vendorName,
  bpCurrency,
  currencyRows = [],
  companyLocalCurrency,
}) {
  const code = String(vendorCode || '').trim();
  const rawBpCurrency = pickField({ Currency: bpCurrency }, 'Currency') || bpCurrency;
  const singleCurrency = normalizeCurrencyCode(rawBpCurrency);

  if (singleCurrency) {
    return {
      vendorCode: code,
      vendorName: vendorName || code,
      currencyMode: 'single',
      currency: singleCurrency,
      defaultCurrency: singleCurrency,
      allowedCurrencies: [{ code: singleCurrency, name: singleCurrency }],
    };
  }

  const fromRows = dedupeCurrencyList(
    currencyRows.map(mapIncludedCurrencyRow).filter(Boolean),
  );

  const allowedCurrencies =
    fromRows.length > 0
      ? fromRows.map(({ code: c, name }) => ({ code: c, name: name || c }))
      : [];

  if (!allowedCurrencies.length) {
    return {
      vendorCode: code,
      vendorName: vendorName || code,
      currencyMode: 'all',
      currency: null,
      defaultCurrency: null,
      allowedCurrencies: [],
      error: 'NO_CURRENCIES',
    };
  }

  const defaultCurrency = pickDefaultCurrency(
    fromRows,
    null,
    companyLocalCurrency || resolveDefaultPoDocCurrency(),
  );

  return {
    vendorCode: code,
    vendorName: vendorName || code,
    currencyMode: 'all',
    currency: null,
    defaultCurrency,
    allowedCurrencies,
  };
}

function mapHanaCurrencyRow(row) {
  const code = normalizeCurrencyCode(pickField(row, 'Currency', 'CURRENCY', 'CurrCode'));
  if (!code) return null;
  const includeRaw = pickField(row, 'Include', 'INCLUDE');
  if (includeRaw != null && !isTruthySapFlag(includeRaw)) return null;
  const isDefault = isTruthySapFlag(
    pickField(row, 'Default', 'DEFAULT', 'DefaultCurr', 'IsDefault'),
  );
  const name = pickField(row, 'CurrName', 'CURRNAME', 'CurrencyName') || code;
  return { code, name: String(name).trim() || code, isDefault };
}

async function loadVendorCurrencyFromHana(vendorCode) {
  const [rows, companyLocalCurrency] = await Promise.all([
    listVendorCurrencyRows(vendorCode),
    getCompanyLocalCurrency().catch(() => null),
  ]);
  const bpCurrency = pickField(rows[0], 'BpCurrency', 'BP_CURRENCY', 'HeaderCurrency');

  if (!isSapAllCurrenciesToken(bpCurrency) && normalizeCurrencyCode(bpCurrency)) {
    return normalizeVendorCurrencyConfig({
      vendorCode,
      bpCurrency,
      currencyRows: [],
      companyLocalCurrency,
    });
  }

  const currencyRows = rows.map(mapHanaCurrencyRow).filter(Boolean);
  return normalizeVendorCurrencyConfig({
    vendorCode,
    bpCurrency,
    currencyRows,
    companyLocalCurrency,
  });
}

async function loadVendorCurrencyFromServiceLayer(vendorCode) {
  const bp = await getBusinessPartner(vendorCode);
  if (!bp) return null;
  const bpCurrency = pickField(bp, 'Currency', 'currency');
  const collection = extractBpCurrencyCollection(bp);
  let companyLocalCurrency = null;
  if (isSapAllCurrenciesToken(bpCurrency) && !collection.length) {
    companyLocalCurrency = await getCompanyLocalCurrency().catch(() => null);
  }
  return normalizeVendorCurrencyConfig({
    vendorCode: pickField(bp, 'CardCode', 'cardCode') || vendorCode,
    vendorName: pickField(bp, 'CardName', 'cardName'),
    bpCurrency,
    currencyRows: collection,
    companyLocalCurrency,
  });
}

export async function getVendorCurrencyConfig(vendorCode) {
  const code = String(vendorCode || '').trim();
  if (!code) {
    const err = new Error('Vendor code is required');
    err.code = 'VENDOR_REQUIRED';
    throw err;
  }

  const cacheKey = `sap:vendor-currencies:${code}`;
  const cached = getLookupCache(cacheKey);
  if (cached) return cached;

  let config = null;
  let lastError = null;

  try {
    config = await loadVendorCurrencyFromServiceLayer(code);
    if (config?.allowedCurrencies?.length || config?.currencyMode === 'single') {
      setLookupCache(cacheKey, config);
      return config;
    }
    if (config?.error === 'NO_CURRENCIES') {
      lastError = new Error('No currencies are configured for this Vendor');
      lastError.code = 'NO_CURRENCIES';
    }
  } catch (err) {
    lastError = err;
  }

  try {
    const hanaConfig = await loadVendorCurrencyFromHana(code);
    if (hanaConfig?.allowedCurrencies?.length || hanaConfig?.currencyMode === 'single') {
      setLookupCache(cacheKey, hanaConfig);
      return hanaConfig;
    }
    if (hanaConfig?.error === 'NO_CURRENCIES' && !lastError) {
      lastError = new Error('No currencies are configured for this Vendor');
      lastError.code = 'NO_CURRENCIES';
    }
  } catch (err) {
    lastError = lastError || err;
  }

  const err = lastError || new Error('Vendor currency configuration could not be loaded from SAP');
  err.code = err.code || 'VENDOR_CURRENCY_CONFIG';
  throw err;
}

export function validatePoDocCurrencyForVendor(docCurrency, vendorConfig) {
  if (!vendorConfig) {
    return {
      ok: false,
      code: 'VENDOR_CURRENCY_CONFIG',
      message: 'Vendor currency configuration could not be loaded from SAP',
    };
  }
  if (isSapAllCurrenciesToken(docCurrency)) {
    return {
      ok: false,
      code: 'INVALID_CURRENCY',
      message: 'Selected currency is not allowed for this Vendor',
    };
  }
  const normalized = normalizeCurrencyCode(docCurrency);
  if (!normalized) {
    return {
      ok: false,
      code: 'INVALID_CURRENCY',
      message: 'Selected currency is not allowed for this Vendor',
    };
  }
  const allowed = new Set(
    (vendorConfig.allowedCurrencies || []).map((c) => normalizeCurrencyCode(c.code)).filter(Boolean),
  );
  if (vendorConfig.currencyMode === 'single') {
    const single = normalizeCurrencyCode(vendorConfig.currency || vendorConfig.defaultCurrency);
    if (single) allowed.add(single);
  }
  if (!allowed.has(normalized)) {
    return {
      ok: false,
      code: 'INVALID_CURRENCY',
      message: 'Selected currency is not allowed for this Vendor',
    };
  }
  return { ok: true, currency: normalized };
}

export async function assertPoDocCurrencyAllowedForVendor(vendorCode, docCurrency) {
  const config = await getVendorCurrencyConfig(vendorCode);
  const result = validatePoDocCurrencyForVendor(docCurrency, config);
  if (!result.ok) {
    const err = new Error(result.message);
    err.code = result.code;
    throw err;
  }
  return { config, currency: result.currency };
}

export {
  SAP_ALL_CURRENCIES_TOKEN,
  isSapAllCurrenciesToken,
  normalizeCurrencyCode,
} from '@/lib/sap/currencyTokens.js';
