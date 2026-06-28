export const SAP_ALL_CURRENCIES_TOKEN = '##';

export function isSapAllCurrenciesToken(value) {
  return String(value ?? '').trim() === SAP_ALL_CURRENCIES_TOKEN;
}

/** Normalize to uppercase ISO-like code; never returns ##. */
export function normalizeCurrencyCode(value) {
  if (value == null || value === '') return null;
  const code = String(value).trim().toUpperCase();
  if (!code || isSapAllCurrenciesToken(code)) return null;
  if (code.length < 3 || code.length > 4) return null;
  return code;
}
