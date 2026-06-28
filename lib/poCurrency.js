import {
  DEV_DEFAULT_PO_DOC_CURRENCY,
  DEV_DEFAULT_PO_DOC_RATE,
} from '@/lib/sap/sapPoConfig.js';
import {
  isSapAllCurrenciesToken,
  normalizeCurrencyCode,
} from '@/lib/sap/currencyTokens.js';

/** @deprecated Use vendor-specific allowed currencies in forms. Kept for legacy fallbacks. */
export const PO_DOC_CURRENCIES = ['USD', 'IQD'];

export function isBlockedSapCurrencyToken(value) {
  return isSapAllCurrenciesToken(value);
}

/** Normalize portal PO header currency; never returns ##. */
export function normalizePoDocCurrency(value, fallback = DEV_DEFAULT_PO_DOC_CURRENCY) {
  const normalized = normalizeCurrencyCode(value);
  if (normalized) return normalized;
  const fb = normalizeCurrencyCode(fallback);
  return fb || DEV_DEFAULT_PO_DOC_CURRENCY;
}

export function isUsdPoCurrency(currency) {
  return normalizePoDocCurrency(currency) === 'USD';
}

/** DocRate persisted on MongoDB (USD only). */
export function normalizePoDocRateForStorage(currency, docRate) {
  if (!isUsdPoCurrency(currency)) return undefined;
  if (docRate === null || docRate === '') return undefined;
  const n = Number(docRate);
  if (!Number.isFinite(n) || n <= 0) return DEV_DEFAULT_PO_DOC_RATE;
  return n;
}

/** Exchange rate string for PO edit/create forms. */
export function resolveFormDocRateFromPo(po) {
  const docCurrency = normalizePoDocCurrency(po?.docCurrency);
  if (!isUsdPoCurrency(docCurrency)) return '';
  const rate = po?.docRate ?? po?.DocRate;
  if (rate != null && rate !== '') return String(rate);
  return String(DEV_DEFAULT_PO_DOC_RATE);
}

export function resolveFormDocCurrencyFromPo(po) {
  return normalizePoDocCurrency(po?.docCurrency);
}

function resolveDocRateForCurrency(docCurrency, prevRate = '') {
  if (isUsdPoCurrency(docCurrency)) {
    if (!String(prevRate).trim()) {
      return String(DEV_DEFAULT_PO_DOC_RATE);
    }
    return prevRate;
  }
  return '';
}

/** Apply vendor currency config after SAP currency detail load. */
export function applyVendorCurrencyConfigToHeader(vendorConfig, prevHeader = {}) {
  if (!vendorConfig?.allowedCurrencies?.length) {
    return {
      docCurrency: prevHeader.docCurrency || '',
      docRate: prevHeader.docRate ?? '',
    };
  }
  const allowed = vendorConfig.allowedCurrencies.map((c) => c.code);
  const prevCode = normalizeCurrencyCode(prevHeader.docCurrency);
  const docCurrency =
    prevCode && allowed.includes(prevCode)
      ? prevCode
      : normalizePoDocCurrency(vendorConfig.defaultCurrency);
  const docRate = resolveDocRateForCurrency(docCurrency, prevHeader.docRate);
  return { docCurrency, docRate };
}

/** Legacy helper when only list-row currency is known (may be ##). */
export function applyVendorCurrencyToHeader(vendor, prevHeader = {}) {
  const raw = vendor?.currency;
  if (isSapAllCurrenciesToken(raw)) {
    return {
      docCurrency: prevHeader.docCurrency || '',
      docRate: prevHeader.docRate ?? '',
    };
  }
  const docCurrency = normalizePoDocCurrency(raw, prevHeader.docCurrency || DEV_DEFAULT_PO_DOC_CURRENCY);
  const docRate = resolveDocRateForCurrency(docCurrency, prevHeader.docRate);
  return { docCurrency, docRate };
}

/** When user changes currency dropdown. */
export function applyCurrencyChangeToHeader(newCurrency, prevHeader = {}) {
  const docCurrency = normalizePoDocCurrency(newCurrency);
  const docRate = resolveDocRateForCurrency(docCurrency, prevHeader.docRate);
  return { docCurrency, docRate };
}

export function getAllowedCurrencyCodes(vendorConfig) {
  if (!vendorConfig?.allowedCurrencies?.length) return [];
  return vendorConfig.allowedCurrencies.map((c) => c.code).filter(Boolean);
}

export function isCurrencyDropdownReadOnly(vendorConfig) {
  return vendorConfig?.currencyMode === 'single' && getAllowedCurrencyCodes(vendorConfig).length <= 1;
}
