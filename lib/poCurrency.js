import {
  DEV_DEFAULT_PO_DOC_CURRENCY,
  DEV_DEFAULT_PO_DOC_RATE,
} from '@/lib/sap/sapPoConfig.js';

export const PO_DOC_CURRENCIES = ['USD', 'IQD'];

/** Normalize portal PO header currency to USD or IQD. */
export function normalizePoDocCurrency(value, fallback = DEV_DEFAULT_PO_DOC_CURRENCY) {
  const c = String(value ?? '').trim().toUpperCase();
  if (c === 'IQD') return 'IQD';
  if (c === 'USD') return 'USD';
  const fb = String(fallback ?? '').trim().toUpperCase();
  if (fb === 'IQD' || fb === 'USD') return fb;
  return 'USD';
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

/** Apply vendor SAP currency when user picks a vendor (preserves rate unless switching to USD with empty rate). */
export function applyVendorCurrencyToHeader(vendor, prevHeader = {}) {
  const docCurrency = normalizePoDocCurrency(
    vendor?.currency,
    prevHeader.docCurrency || DEV_DEFAULT_PO_DOC_CURRENCY,
  );
  let docRate = prevHeader.docRate ?? '';
  if (isUsdPoCurrency(docCurrency)) {
    if (!String(docRate).trim()) {
      docRate = String(DEV_DEFAULT_PO_DOC_RATE);
    }
  } else {
    docRate = '';
  }
  return { docCurrency, docRate };
}

/** When user changes currency dropdown. */
export function applyCurrencyChangeToHeader(newCurrency, prevHeader = {}) {
  const docCurrency = normalizePoDocCurrency(newCurrency);
  let docRate = prevHeader.docRate ?? '';
  if (isUsdPoCurrency(docCurrency)) {
    if (!String(docRate).trim()) {
      docRate = String(DEV_DEFAULT_PO_DOC_RATE);
    }
  } else {
    docRate = '';
  }
  return { docCurrency, docRate };
}
