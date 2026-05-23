/**
 * Defaults for standalone SAP Purchase Orders (no PR base document).
 */
export const DEV_DEFAULT_PO_DOC_CURRENCY = 'USD';
export const DEV_DEFAULT_PO_DOC_RATE = 1350;

export function resolveDefaultPoDocCurrency() {
  const fromEnv = process.env.DEFAULT_PO_DOC_CURRENCY?.trim();
  if (fromEnv) return fromEnv;
  return DEV_DEFAULT_PO_DOC_CURRENCY;
}

export function resolveDefaultPoDocRate() {
  const raw = process.env.DEFAULT_PO_DOC_RATE?.trim();
  if (raw) {
    const value = Number(raw);
    if (Number.isFinite(value) && value > 0) return value;
  }
  if (process.env.NODE_ENV !== 'production') {
    return DEV_DEFAULT_PO_DOC_RATE;
  }
  return null;
}

export function shouldSendPrUdfFields() {
  return process.env.SAP_PO_SEND_PR_UDF_FIELDS === 'true';
}
