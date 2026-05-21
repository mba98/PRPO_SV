import { linesForVendor, vendorsFromPrLines } from '@/lib/sap/mappers/poToSap.js';

/**
 * Whether a PR still has capacity for at least one more SAP PO (per vendor rules).
 */
export function prHasOpenPoSlots(pr, purchaseOrders = []) {
  if (!pr?.sapPRDocEntry) return false;
  if (pr.status === 'Fully Ordered') return false;
  if (!['Created in SAP', 'Partially Ordered'].includes(pr.status)) return false;

  const completedVendors = new Set(
    purchaseOrders
      .filter((o) => o.sapPODocEntry != null)
      .map((o) => (o.vendor || '').trim()),
  );

  const suggested = vendorsFromPrLines(pr);
  if (suggested.length === 0) {
    return (pr.lines || []).some((l) => (l.quantity || 0) > (l.orderedQty || 0));
  }

  const vendorPending = suggested.some(
    (v) => !completedVendors.has(v) && linesForVendor(pr, v).length > 0,
  );
  const orphanRemaining = (pr.lines || []).some(
    (l) => !(l.vendor || '').trim() && (l.quantity || 0) > (l.orderedQty || 0),
  );
  return vendorPending || orphanRemaining;
}

export function enrichPrForPoList(pr, purchaseOrders = []) {
  const prId = pr._id?.toString() || pr.id;
  const related = purchaseOrders.filter(
    (o) => (o.relatedPRId?._id?.toString() || o.relatedPRId?.toString()) === prId,
  );
  const suggestedVendors = vendorsFromPrLines(pr);
  const completedVendors = related
    .filter((o) => o.sapPODocEntry != null)
    .map((o) => ({ vendor: o.vendor, portalPONumber: o.portalPONumber, sapPODocNum: o.sapPODocNum }));
  const pendingVendors = suggestedVendors.filter(
    (v) => !completedVendors.some((c) => c.vendor === v) && linesForVendor(pr, v).length > 0,
  );

  return {
    suggestedVendors,
    pendingVendors,
    existingPOs: related.map((o) => ({
      id: o._id?.toString(),
      portalPONumber: o.portalPONumber,
      vendor: o.vendor,
      status: o.status,
      sapPODocEntry: o.sapPODocEntry,
      sapPODocNum: o.sapPODocNum,
    })),
    poReady: prHasOpenPoSlots(pr, related),
  };
}
