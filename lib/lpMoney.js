export const LP_CURRENCIES = ['IQD', 'USD'];

export function normalizeLpCurrency(value) {
  const currency = String(value || 'IQD')
    .trim()
    .toUpperCase();
  return LP_CURRENCIES.includes(currency) ? currency : 'IQD';
}

export function parseMoneyInput(value) {
  const cleaned = String(value ?? '').replace(/,/g, '').trim();
  if (cleaned === '') return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

export function formatMoneyInput(value, currency = 'IQD') {
  const number = parseMoneyInput(value);
  if (number === null) return '';
  const c = normalizeLpCurrency(currency);
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: c === 'USD' ? 2 : 0,
  }).format(number);
}

export function formatMoney(value, currency = 'IQD') {
  const number = Number(value || 0);
  const c = normalizeLpCurrency(currency);
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: c === 'USD' ? 2 : 0,
    maximumFractionDigits: c === 'USD' ? 2 : 0,
  }).format(number);
}

export function formatMoneyWithCurrency(value, currency = 'IQD') {
  const c = normalizeLpCurrency(currency);
  return `${c} ${formatMoney(value, c)}`;
}
