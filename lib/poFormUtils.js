export const PO_COMPACT_INPUT = 'input-field-compact';

export const PO_LINE_GRID =
  'lg:grid-cols-[minmax(5.5rem,0.85fr)_minmax(6rem,1.15fr)_4.25rem_5rem_4rem_5rem_4.5rem]';

export function toPoDateInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

import { parseNumberAllowZero } from '@/lib/numberParsing.js';

export function recalcPoLineTotal(line) {
  const q = parseNumberAllowZero(line.quantity, 0);
  const p = parseNumberAllowZero(line.unitPrice, 0);
  return q * p;
}

export function sumPoLineTotals(lines = []) {
  return lines.reduce((sum, line) => sum + recalcPoLineTotal(line), 0);
}

export function parsePoFormDate(value) {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
