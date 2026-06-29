import {
  DEV_DEFAULT_PO_DOC_CURRENCY,
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

export function normalizeLocalCurrency(value) {
  return normalizeCurrencyCode(value);
}

/** @deprecated Prefer isLocalPoCurrency / requiresPoDocRate with company local currency. */
export function isUsdPoCurrency(currency) {
  return normalizePoDocCurrency(currency) === 'USD';
}

export function isLocalPoCurrency(docCurrency, localCurrency) {
  const doc = normalizeCurrencyCode(docCurrency);
  const local = normalizeLocalCurrency(localCurrency);
  if (!doc || !local) return false;
  return doc === local;
}

/** Foreign-currency PO documents require a positive manual DocRate. */
export function requiresPoDocRate(docCurrency, localCurrency) {
  const doc = normalizeCurrencyCode(docCurrency);
  if (!doc) return false;
  return !isLocalPoCurrency(doc, localCurrency);
}

/** Persist DocRate for foreign currencies only; omit for local currency. */
export function normalizePoDocRateForStorage(docCurrency, docRate, localCurrency) {
  if (!requiresPoDocRate(docCurrency, localCurrency)) return undefined;
  if (docRate === null || docRate === '') return undefined;
  const n = Number(docRate);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

export function validatePoDocRateInput(docCurrency, docRate, localCurrency) {
  if (!requiresPoDocRate(docCurrency, localCurrency)) {
    return { ok: true, docRate: undefined };
  }
  const raw = docRate;
  if (raw === null || raw === '' || raw === undefined) {
    return {
      ok: false,
      code: 'DOC_RATE_REQUIRED',
      message: 'Exchange rate is required for a foreign-currency Purchase Order.',
    };
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    return {
      ok: false,
      code: 'INVALID_DOC_RATE',
      message: 'Exchange rate must be greater than zero.',
    };
  }
  return { ok: true, docRate: n };
}

/** Exchange rate string for PO edit/create forms. */
export function resolveFormDocRateFromPo(po, localCurrency) {
  if (!requiresPoDocRate(po?.docCurrency, localCurrency)) return '';
  const rate = po?.docRate ?? po?.DocRate;
  if (rate != null && rate !== '') return String(rate);
  return '';
}

export function resolveFormDocCurrencyFromPo(po) {
  return normalizePoDocCurrency(po?.docCurrency);
}

function resolveDocRateForCurrency(docCurrency, prevHeader = {}, localCurrency) {
  if (!requiresPoDocRate(docCurrency, localCurrency)) return '';
  const prevCode = normalizeCurrencyCode(prevHeader.docCurrency);
  const nextCode = normalizeCurrencyCode(docCurrency);
  if (prevCode && nextCode && prevCode !== nextCode) return '';
  return prevHeader.docRate ?? '';
}

/** Apply vendor currency config after SAP currency detail load. */
export function applyVendorCurrencyConfigToHeader(vendorConfig, prevHeader = {}) {
  const localCurrency = vendorConfig?.companyLocalCurrency;
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
  const docRate =
    prevCode && allowed.includes(prevCode)
      ? resolveDocRateForCurrency(docCurrency, prevHeader, localCurrency)
      : resolveDocRateForCurrency(docCurrency, { docCurrency, docRate: '' }, localCurrency);
  return { docCurrency, docRate };
}

/** Apply vendor currency config to header; returns same object when nothing changed. */
export function mergeHeaderWithVendorCurrency(prevHeader = {}, vendorConfig) {
  const nextLocal =
    vendorConfig?.companyLocalCurrency || prevHeader.companyLocalCurrency || undefined;
  const nextSystem =
    vendorConfig?.companySystemCurrency || prevHeader.companySystemCurrency || undefined;
  const applied = applyVendorCurrencyConfigToHeader(vendorConfig, prevHeader);

  const nextDocCurrency = applied.docCurrency ?? prevHeader.docCurrency ?? '';
  const nextDocRate = applied.docRate ?? prevHeader.docRate ?? '';

  if (
    prevHeader.docCurrency === nextDocCurrency &&
    prevHeader.docRate === nextDocRate &&
    prevHeader.companyLocalCurrency === nextLocal &&
    prevHeader.companySystemCurrency === nextSystem
  ) {
    return prevHeader;
  }

  return {
    ...prevHeader,
    companyLocalCurrency: nextLocal,
    companySystemCurrency: nextSystem,
    docCurrency: nextDocCurrency,
    docRate: nextDocRate,
  };
}

/** Legacy helper when only list-row currency is known (may be ##). */
export function applyVendorCurrencyToHeader(vendor, prevHeader = {}, localCurrency) {
  const raw = vendor?.currency;
  if (isSapAllCurrenciesToken(raw)) {
    return {
      docCurrency: prevHeader.docCurrency || '',
      docRate: prevHeader.docRate ?? '',
    };
  }
  const docCurrency = normalizePoDocCurrency(raw, prevHeader.docCurrency || DEV_DEFAULT_PO_DOC_CURRENCY);
  const docRate = resolveDocRateForCurrency(docCurrency, prevHeader, localCurrency);
  return { docCurrency, docRate };
}

/** When user changes currency dropdown. */
export function applyCurrencyChangeToHeader(newCurrency, prevHeader = {}, localCurrency) {
  const docCurrency = normalizePoDocCurrency(newCurrency);
  const docRate = resolveDocRateForCurrency(docCurrency, prevHeader, localCurrency);
  return { docCurrency, docRate };
}

export function getAllowedCurrencyCodes(vendorConfig) {
  if (!vendorConfig?.allowedCurrencies?.length) return [];
  return vendorConfig.allowedCurrencies.map((c) => c.code).filter(Boolean);
}

export function isCurrencyDropdownReadOnly(vendorConfig) {
  return getAllowedCurrencyCodes(vendorConfig).length <= 1;
}

const CURRENCY_SOURCE_ORDER = ['local', 'system', 'bp'];

/** Display label for PO currency dropdown (value remains code only). */
export function formatPoCurrencyOptionLabel(entry, sourceLabels = {}) {
  const code = entry?.code || '';
  if (!code) return '';
  const sources = [...(entry?.sources || [])].sort(
    (a, b) => CURRENCY_SOURCE_ORDER.indexOf(a) - CURRENCY_SOURCE_ORDER.indexOf(b),
  );
  if (sources.length) {
    const parts = sources.map((s) => sourceLabels[s] || s);
    return `${code} — ${parts.join(' / ')}`;
  }
  const name = entry?.name;
  return name && name !== code ? `${code} — ${name}` : code;
}
