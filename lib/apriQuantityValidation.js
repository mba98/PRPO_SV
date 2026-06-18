import PurchaseOrder from '@/models/PurchaseOrder.js';

/**
 * Validate APRI line quantity updates against the related SAP PO (qty-only edits).
 */
export async function validateApriQuantityUpdates(apri, lineUpdates) {
  if (!lineUpdates?.length) {
    const err = new Error('At least one line is required');
    err.code = 'VALIDATION';
    throw err;
  }

  const po = await PurchaseOrder.findById(apri.relatedPOId).lean();
  if (!po) {
    const err = new Error('Related purchase order not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

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

    const existing = apri.lines.id(update._id);
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

    const poLine = po.lines?.find(
      (l) => l._id?.toString() === existing.relatedPOLineId?.toString(),
    );
    const maxQty = poLine?.quantity ?? existing.quantity;
    if (qty > maxQty) {
      const err = new Error(
        `Quantity for ${existing.itemCode || 'line'} cannot exceed PO quantity (${maxQty})`,
      );
      err.code = 'VALIDATION';
      throw err;
    }
  }

  if (seenLineIds.size !== apri.lines.length) {
    const err = new Error('All APRI lines must be included without adding or removing items');
    err.code = 'VALIDATION';
    throw err;
  }
}
