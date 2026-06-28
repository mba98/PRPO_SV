import { getLookupCache, setLookupCache } from '@/lib/sapLookupCache.js';
import { getBusinessPartner } from '@/lib/sapServiceLayer.js';
import { listVendorCurrencyRows, getCompanyLocalCurrency } from '@/lib/sapHana.js';
import { resolveDefaultPoDocCurrency } from '@/lib/sap/sapPoConfig.js';
import {
  validatePoDocRateInput,
} from '@/lib/poCurrency.js';

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
  return pickField(
    row,
    'CurrencyCode',
    'currencyCode',
    'CurrCode',
    'Currency',
    'currency',
  );
}

function resolveCurrencyName(code, row) {
  const fromRow = pickField(row, 'currencyName', 'CurrencyName', 'CurrName', 'Name');
  if (fromRow) return String(fromRow).trim();
  return code;
}

function resolveIncludedFlag(row) {
  return pickField(row, 'included', 'Include', 'Included', 'INCLUDE', 'include');
}

function resolveDefaultFlag(row) {
  const locked = pickField(row, 'locked', 'Locked', 'LOCKED');
  if (locked != null && isTruthySapFlag(locked)) return true;
  return isTruthySapFlag(
    pickField(row, 'Default', 'DefaultCurrency', 'IsDefault', 'DefaultCurr', 'default'),
  );
}

function mapIncludedCurrencyRow(row) {
  const code = normalizeCurrencyCode(resolveRawBpCurrency(row));
  if (!code) return null;
  const includeRaw = resolveIncludedFlag(row);
  if (includeRaw != null && !isTruthySapFlag(includeRaw)) return null;
  const isDefault = resolveDefaultFlag(row);
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

function pickDefaultCurrency(fromRows, companyLocalCurrency) {
  const allowed = fromRows.map((c) => c.code);
  const flagged = fromRows.find((c) => c.isDefault);
  if (flagged) return flagged.code;
  const fb = normalizeCurrencyCode(companyLocalCurrency);
  if (fb && allowed.includes(fb)) return fb;
  return allowed[0] || fb || resolveDefaultPoDocCurrency();
}

function attachCompanyLocalCurrency(config, companyLocalCurrency) {
  const local = normalizeCurrencyCode(companyLocalCurrency);
  return local ? { ...config, companyLocalCurrency: local } : config;
}

function isSuccessfulVendorConfig(config) {
  return Boolean(
    config &&
      !config.error &&
      (config.currencyMode === 'single' || config.allowedCurrencies?.length),
  );
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
  const localCurrency = normalizeCurrencyCode(companyLocalCurrency);

  if (singleCurrency) {
    return attachCompanyLocalCurrency(
      {
        vendorCode: code,
        vendorName: vendorName || code,
        currencyMode: 'single',
        currency: singleCurrency,
        defaultCurrency: singleCurrency,
        allowedCurrencies: [{ code: singleCurrency, name: singleCurrency }],
      },
      localCurrency,
    );
  }

  const fromRows = dedupeCurrencyList(
    currencyRows.map(mapIncludedCurrencyRow).filter(Boolean),
  );

  const allowedCurrencies =
    fromRows.length > 0
      ? fromRows.map(({ code: c, name }) => ({ code: c, name: name || c }))
      : [];

  if (!allowedCurrencies.length) {
    return attachCompanyLocalCurrency(
      {
        vendorCode: code,
        vendorName: vendorName || code,
        currencyMode: 'all',
        currency: null,
        defaultCurrency: null,
        allowedCurrencies: [],
        error: 'NO_CURRENCIES',
      },
      localCurrency,
    );
  }

  const defaultCurrency = pickDefaultCurrency(fromRows, localCurrency);

  return attachCompanyLocalCurrency(
    {
      vendorCode: code,
      vendorName: vendorName || code,
      currencyMode: 'all',
      currency: null,
      defaultCurrency,
      allowedCurrencies,
    },
    localCurrency,
  );
}

function mapHanaCurrencyRow(row) {
  const code = normalizeCurrencyCode(
    pickField(row, 'currencyCode', 'Currency', 'CurrCode', 'CURRENCY'),
  );
  if (!code) return null;
  const includeRaw = resolveIncludedFlag(row);
  if (includeRaw != null && !isTruthySapFlag(includeRaw)) return null;
  const isDefault = resolveDefaultFlag(row);
  const name = pickField(row, 'currencyName', 'CurrName', 'CurrencyName') || code;
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
  const companyLocalCurrency = await getCompanyLocalCurrency().catch(() => null);
  return normalizeVendorCurrencyConfig({
    vendorCode: pickField(bp, 'CardCode', 'cardCode') || vendorCode,
    vendorName: pickField(bp, 'CardName', 'cardName'),
    bpCurrency,
    currencyRows: collection,
    companyLocalCurrency,
  });
}

function cacheVendorCurrencyConfig(cacheKey, config) {
  if (isSuccessfulVendorConfig(config)) {
    setLookupCache(cacheKey, config);
  }
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
  if (cached && isSuccessfulVendorConfig(cached)) return cached;

  let lastError = null;

  try {
    const config = await loadVendorCurrencyFromServiceLayer(code);
    if (isSuccessfulVendorConfig(config)) {
      cacheVendorCurrencyConfig(cacheKey, config);
      return config;
    }
    if (config?.error === 'NO_CURRENCIES') {
      lastError = new Error('Failed to load Vendor currencies from SAP.');
      lastError.code = 'VENDOR_CURRENCY_CONFIG';
    }
  } catch (err) {
    lastError = err;
  }

  try {
    const hanaConfig = await loadVendorCurrencyFromHana(code);
    if (isSuccessfulVendorConfig(hanaConfig)) {
      cacheVendorCurrencyConfig(cacheKey, hanaConfig);
      return hanaConfig;
    }
    if (hanaConfig?.error === 'NO_CURRENCIES' && !lastError) {
      lastError = new Error('Failed to load Vendor currencies from SAP.');
      lastError.code = 'VENDOR_CURRENCY_CONFIG';
    }
  } catch (err) {
    lastError = lastError || err;
  }

  const err = lastError || new Error('Failed to load Vendor currencies from SAP.');
  err.code = err.code || 'VENDOR_CURRENCY_CONFIG';
  throw err;
}

export function validatePoDocCurrencyForVendor(docCurrency, vendorConfig) {
  if (!vendorConfig) {
    return {
      ok: false,
      code: 'VENDOR_CURRENCY_CONFIG',
      message: 'Failed to load Vendor currencies from SAP.',
    };
  }
  if (isSapAllCurrenciesToken(docCurrency)) {
    return {
      ok: false,
      code: 'INVALID_CURRENCY',
      message: 'The selected currency is not allowed for this Vendor.',
    };
  }
  const normalized = normalizeCurrencyCode(docCurrency);
  if (!normalized) {
    return {
      ok: false,
      code: 'INVALID_CURRENCY',
      message: 'The selected currency is not allowed for this Vendor.',
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
      message: 'The selected currency is not allowed for this Vendor.',
    };
  }
  return { ok: true, currency: normalized };
}

export function validatePoDocCurrencyAndRateForVendor(docCurrency, docRate, vendorConfig) {
  const currencyResult = validatePoDocCurrencyForVendor(docCurrency, vendorConfig);
  if (!currencyResult.ok) return currencyResult;
  const rateResult = validatePoDocRateInput(
    currencyResult.currency,
    docRate,
    vendorConfig?.companyLocalCurrency,
  );
  if (!rateResult.ok) return rateResult;
  return {
    ok: true,
    currency: currencyResult.currency,
    docRate: rateResult.docRate,
  };
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

export async function assertPoDocCurrencyAndRateAllowedForVendor(vendorCode, docCurrency, docRate) {
  const config = await getVendorCurrencyConfig(vendorCode);
  const result = validatePoDocCurrencyAndRateForVendor(docCurrency, docRate, config);
  if (!result.ok) {
    const err = new Error(result.message);
    err.code = result.code;
    throw err;
  }
  return { config, currency: result.currency, docRate: result.docRate };
}

export {
  SAP_ALL_CURRENCIES_TOKEN,
  isSapAllCurrenciesToken,
  normalizeCurrencyCode,
} from '@/lib/sap/currencyTokens.js';
