import { parseNumberAllowZero } from '@/lib/numberParsing.js';

function lineAmountFromFields(line, { qtyKey, priceKey, totalKey }) {
  const stored = line[totalKey];
  if (stored != null && stored !== '') {
    const n = Number(stored);
    if (Number.isFinite(n)) return n;
  }
  const qty = parseNumberAllowZero(line[qtyKey], 0);
  const price = parseNumberAllowZero(line[priceKey], 0);
  return qty * price;
}

export function sumPrDocumentTotal(lines = []) {
  return lines.reduce(
    (sum, line) =>
      sum +
      lineAmountFromFields(line, {
        qtyKey: 'quantity',
        priceKey: 'estimatedUnitPrice',
        totalKey: 'estimatedTotal',
      }),
    0,
  );
}

export function sumPoDocumentTotal(lines = []) {
  return lines.reduce(
    (sum, line) =>
      sum +
      lineAmountFromFields(line, {
        qtyKey: 'quantity',
        priceKey: 'unitPrice',
        totalKey: 'lineTotal',
      }),
    0,
  );
}

export function sumApriDocumentTotal(lines = []) {
  return lines.reduce(
    (sum, line) =>
      sum +
      lineAmountFromFields(line, {
        qtyKey: 'quantity',
        priceKey: 'unitPrice',
        totalKey: 'lineTotal',
      }),
    0,
  );
}

export function sumLineQuantities(lines = []) {
  return lines.reduce((sum, line) => sum + parseNumberAllowZero(line.quantity, 0), 0);
}

export function formatDocumentTotalAmount(value, locale) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString(locale, { maximumFractionDigits: 2 });
}
