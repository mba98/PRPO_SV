import APReserveInvoice from '@/models/APReserveInvoice.js';
import PurchaseOrder from '@/models/PurchaseOrder.js';
import {
  APRI_STATUS,
  apriStatusInQuery,
} from '@/lib/apriStatus.js';

/** Statuses where another APRI's line quantity counts as consumed on the PO. */
const CONSUMING_APRI_STATUSES = [
  APRI_STATUS.CREATING_IN_SAP,
  APRI_STATUS.CREATED_IN_SAP,
];

/**
 * One APRI per PO is enforced at creation time; other APRIs on the same PO line
 * are still summed here for forward-compatible remaining-quantity checks.
 */
export async function loadUsedQuantitiesByPoLine(relatedPOId, excludeApriId = null) {
  if (!relatedPOId) return new Map();

  const filter = {
    relatedPOId,
    status: apriStatusInQuery(...CONSUMING_APRI_STATUSES),
  };
  if (excludeApriId) {
    filter._id = { $ne: excludeApriId };
  }

  const others = await APReserveInvoice.find(filter).select('lines').lean();
  const used = new Map();
  for (const doc of others) {
    for (const line of doc.lines || []) {
      const poLineId = line.relatedPOLineId?.toString();
      if (!poLineId) continue;
      const qty = Number(line.quantity) || 0;
      used.set(poLineId, (used.get(poLineId) || 0) + qty);
    }
  }
  return used;
}

export async function loadPoWithLines(relatedPOId) {
  if (!relatedPOId) return null;
  return PurchaseOrder.findById(relatedPOId).lean();
}

export function computeLineQuantityLimit(line, po, usedByPoLine) {
  const poLineId = line.relatedPOLineId?.toString();
  const poLine = po?.lines?.find((l) => l._id?.toString() === poLineId);
  const poQuantity = Number(poLine?.quantity ?? line.quantity ?? 0);
  const previouslyUsedQuantity = poLineId ? (usedByPoLine.get(poLineId) || 0) : 0;
  const remainingPoQuantity = Math.max(0, poQuantity - previouslyUsedQuantity);
  return { poQuantity, previouslyUsedQuantity, remainingPoQuantity };
}

export function enrichApriLine(line, po, usedByPoLine) {
  const limits = computeLineQuantityLimit(line, po, usedByPoLine);
  const id = line._id?.toString() || line.id;
  return {
    ...line,
    _id: id,
    ...limits,
  };
}

export function enrichApriLines(apri, po, usedByPoLine) {
  return (apri.lines || []).map((line) => enrichApriLine(line, po, usedByPoLine));
}

export function apriSavedQuantitiesAreValid(lines) {
  if (!lines?.length) return false;
  return lines.every((line) => {
    const qty = Number(line.quantity);
    const max = Number(line.remainingPoQuantity ?? line.poQuantity);
    if (!Number.isFinite(qty) || qty <= 0) return false;
    if (!Number.isFinite(max)) return true;
    return qty <= max;
  });
}

export function buildQuantityExceedsMessage(itemCode, maximumQuantity, locale = 'en') {
  const code = itemCode || 'line';
  if (locale === 'ar') {
    return `الكمية المطلوبة للمادة ${code} لا يمكن أن تتجاوز الكمية المتبقية في أمر الشراء، وهي ${maximumQuantity}.`;
  }
  return `Quantity for ${code} cannot exceed the remaining PO quantity of ${maximumQuantity}.`;
}

export function buildLineQuantityError(line, requestedQuantity, maximumQuantity, locale = 'en') {
  const itemCode = line.itemCode || 'line';
  return {
    lineId: line._id?.toString() || line.id,
    itemCode,
    field: 'quantity',
    requestedQuantity,
    maximumQuantity,
    message:
      locale === 'ar'
        ? `لا يمكن أن تتجاوز الكمية الكمية المتبقية في أمر الشراء (${maximumQuantity}).`
        : `Quantity cannot exceed the remaining PO quantity of ${maximumQuantity}.`,
  };
}

export function createApriQuantityValidationError(errors, locale = 'en') {
  const err = new Error(
    locale === 'ar'
      ? 'واحدة أو أكثر من الكميات تتجاوز الكمية المتبقية في أمر الشراء.'
      : 'One or more quantities exceed the remaining PO quantity.',
  );
  err.code = 'APRI_QUANTITY_EXCEEDS_PO';
  err.errors = errors;
  return err;
}

/**
 * Validate APRI line quantity updates against remaining PO line quantities.
 */
export async function validateApriQuantityUpdates(apri, lineUpdates, { locale = 'en' } = {}) {
  if (!lineUpdates?.length) {
    const err = new Error('At least one line is required');
    err.code = 'VALIDATION';
    throw err;
  }

  const po = await loadPoWithLines(apri.relatedPOId);
  if (!po) {
    const err = new Error('Related purchase order not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const apriId = apri._id?.toString() || apri.id;
  const usedByPoLine = await loadUsedQuantitiesByPoLine(apri.relatedPOId, apriId);
  const lineErrors = [];
  const seenLineIds = new Set();

  for (const update of lineUpdates) {
    if (!update._id) {
      const err = new Error('Line identifier is required');
      err.code = 'VALIDATION';
      throw err;
    }
    const lineId = String(update._id);
    if (seenLineIds.has(lineId)) {
      const err = new Error('Duplicate line updates are not allowed');
      err.code = 'VALIDATION';
      throw err;
    }
    seenLineIds.add(lineId);

    const existing = apri.lines.id ? apri.lines.id(update._id) : apri.lines.find((l) => String(l._id) === lineId);
    if (!existing) {
      const err = new Error('Cannot add or replace APRI lines');
      err.code = 'VALIDATION';
      throw err;
    }

    const qty = Number(update.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      const err = new Error('Quantity must be positive');
      err.code = 'VALIDATION';
      throw err;
    }

    const { remainingPoQuantity } = computeLineQuantityLimit(existing, po, usedByPoLine);
    if (qty > remainingPoQuantity) {
      lineErrors.push(buildLineQuantityError(existing, qty, remainingPoQuantity, locale));
    }
  }

  if (lineErrors.length) {
    const first = lineErrors[0];
    const err = createApriQuantityValidationError(lineErrors, locale);
    err.message = buildQuantityExceedsMessage(first.itemCode, first.maximumQuantity, locale);
    throw err;
  }

  const lineCount = apri.lines.id ? apri.lines.length : apri.lines?.length;
  if (seenLineIds.size !== lineCount) {
    const err = new Error('All APRI lines must be included without adding or removing items');
    err.code = 'VALIDATION';
    throw err;
  }
}
