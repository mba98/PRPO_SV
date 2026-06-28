import { getLookupCache, setLookupCache } from '@/lib/sapLookupCache.js';
import { getBusinessPartner } from '@/lib/sapServiceLayer.js';
import {
  getVendorHeaderFromHana,
  listVendorCrd13CurrencyRows,
  getCompanyLocalCurrency,
} from '@/lib/sapHana.js';
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

export function readField(row, field) {
  if (!row || typeof row !== 'object') return undefined;
  const key = Object.keys(row).find(
    (candidate) => candidate.toLowerCase() === String(field).toLowerCase(),
  );
  const value = key ? row[key] : undefined;
  return value != null && value !== '' ? value : undefined;
}

function pickField(row, ...keys) {
  if (!row || typeof row !== 'object') return undefined;
  for (const key of keys) {
    const value = readField(row, key);
    if (value != null) return value;
  }
  return undefined;
}

function createVendorCurrencyError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
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

async function loadMultiCurrencyVendorFromHana(vendorCode, options = {}) {
  const companyLocalCurrency = await getCompanyLocalCurrency().catch(() => null);

  let header = null;
  try {
    header = await getVendorHeaderFromHana(vendorCode);
  } catch (error) {
    console.error('[vendor-currencies] OCRD header lookup failed', {
      vendorCode,
      name: error?.name,
      code: error?.code,
      message: error?.message,
      stack: error?.stack,
    });
  }

  const bpCurrency =
    readField(header, 'bpCurrency') ??
    readField(header, 'Currency') ??
    SAP_ALL_CURRENCIES_TOKEN;
  const vendorName =
    options.vendorName ??
    readField(header, 'cardName') ??
    readField(header, 'CardName') ??
    vendorCode;

  console.log('[vendor-currencies] BP resolved', {
    vendorCode,
    bpCurrency,
  });

  if (!isSapAllCurrenciesToken(bpCurrency) && normalizeCurrencyCode(bpCurrency)) {
    return normalizeVendorCurrencyConfig({
      vendorCode,
      vendorName,
      bpCurrency,
      currencyRows: [],
      companyLocalCurrency,
    });
  }

  console.log('[vendor-currencies] loading CRD13', { vendorCode });

  let rows;
  try {
    rows = await listVendorCrd13CurrencyRows(vendorCode);
    console.log('[vendor-currencies] CRD13 rows', {
      vendorCode,
      rowCount: rows?.length,
    });
  } catch (error) {
    console.error('[vendor-currencies] CRD13 lookup failed', {
      vendorCode,
      name: error?.name,
      code: error?.code,
      message: error?.message,
      stack: error?.stack,
    });
    throw error;
  }

  const config = normalizeVendorCurrencyConfig({
    vendorCode,
    vendorName,
    bpCurrency,
    currencyRows: rows,
    companyLocalCurrency,
  });

  if (config.error === 'NO_CURRENCIES') {
    throw createVendorCurrencyError(
      'VENDOR_CURRENCIES_NOT_RESOLVED',
      `No included CRD13 currencies were resolved for ${vendorCode}`,
    );
  }

  return config;
}

async function loadVendorCurrencyFromServiceLayer(vendorCode) {
  const bp = await getBusinessPartner(vendorCode);
  if (!bp) return null;
  const bpCurrency = pickField(bp, 'Currency', 'currency');
  console.log('[vendor-currencies] BP resolved', {
    vendorCode,
    bpCurrency,
  });
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

  let serviceLayerConfig = null;
  let serviceLayerVendorName = null;

  try {
    serviceLayerConfig = await loadVendorCurrencyFromServiceLayer(code);
    serviceLayerVendorName = serviceLayerConfig?.vendorName ?? null;
    if (isSuccessfulVendorConfig(serviceLayerConfig)) {
      cacheVendorCurrencyConfig(cacheKey, serviceLayerConfig);
      return serviceLayerConfig;
    }
  } catch (err) {
    console.error('[vendor-currencies] Service Layer lookup failed', {
      vendorCode: code,
      name: err?.name,
      code: err?.code,
      message: err?.message,
    });
  }

  try {
    const hanaConfig = await loadMultiCurrencyVendorFromHana(code, {
      vendorName: serviceLayerVendorName,
    });
    if (isSuccessfulVendorConfig(hanaConfig)) {
      cacheVendorCurrencyConfig(cacheKey, hanaConfig);
      return hanaConfig;
    }
  } catch (err) {
    console.error('[vendor-currencies] HANA fallback failed', {
      vendorCode: code,
      name: err?.name,
      code: err?.code,
      message: err?.message,
    });
    const failure = createVendorCurrencyError(
      err.code || 'VENDOR_CURRENCY_CONFIG',
      'Failed to load Vendor currencies from SAP.',
    );
    throw failure;
  }

  throw createVendorCurrencyError(
    'VENDOR_CURRENCY_CONFIG',
    'Failed to load Vendor currencies from SAP.',
  );
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
