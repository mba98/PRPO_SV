import { linesForVendor, vendorsFromPrLines } from '@/lib/sap/mappers/poToSap.js';

function prIdString(pr) {
  return pr?._id?.toString() || pr?.id || '';
}

function orderMatchesPr(order, prId) {
  if (!prId) return false;
  const orderPrId = order.relatedPRId?._id?.toString() || order.relatedPRId?.toString();
  return orderPrId === prId;
}

/**
 * True when a non-rejected portal PO already exists for this PR.
 */
export function prHasPortalPurchaseOrder(pr, purchaseOrders = []) {
  const prId = prIdString(pr);
  if (!prId) return false;

  const hasLinkedOrder = purchaseOrders.some(
    (o) => o.status !== 'Rejected' && orderMatchesPr(o, prId),
  );
  if (hasLinkedOrder) return true;

  if (pr.relatedPortalPONumber) return true;
  if (pr.relatedPOId) return true;
  if (pr.relatedPONumber) return true;
  if (pr.relatedSAPPODocEntry != null) return true;
  if (pr.relatedSAPPODocNum) return true;

  return false;
}

export function prHasSapPurchaseRequest(pr) {
  return pr?.sapPRDocEntry != null || Boolean(pr?.sapPRDocNum);
}

/**
 * Whether PR should appear on the approved-for-PO list (no portal PO yet).
 */
export function prIsEligibleForReadyForPoList(pr, purchaseOrders = []) {
  if (!pr) return false;
  if (pr.status === 'Rejected' || pr.status === 'Fully Ordered') return false;
  if (!prHasSapPurchaseRequest(pr)) return false;
  if (!['Created in SAP', 'Partially Ordered'].includes(pr.status)) return false;
  if (prHasPortalPurchaseOrder(pr, purchaseOrders)) return false;
  return prHasOpenPoSlots(pr, purchaseOrders);
}

/**
 * Whether a PR still has capacity for at least one more SAP PO (per vendor rules).
 */
export function prHasOpenPoSlots(pr, purchaseOrders = []) {
  if (!pr?.sapPRDocEntry) return false;
  if (pr.status === 'Fully Ordered') return false;
  if (!['Created in SAP', 'Partially Ordered'].includes(pr.status)) return false;

  const blockedVendors = new Set(
    purchaseOrders
      .filter((o) => o.status !== 'Rejected')
      .map((o) => (o.vendor || '').trim()),
  );

  const suggested = vendorsFromPrLines(pr);
  if (suggested.length === 0) {
    return (pr.lines || []).some((l) => (l.quantity || 0) > (l.orderedQty || 0));
  }

  const vendorPending = suggested.some(
    (v) => !blockedVendors.has(v) && linesForVendor(pr, v).length > 0,
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
  const activePOs = related.filter((o) => o.status !== 'Rejected');
  const pendingVendors = suggestedVendors.filter(
    (v) => !activePOs.some((o) => o.vendor === v) && linesForVendor(pr, v).length > 0,
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
    poReady: prIsEligibleForReadyForPoList(pr, related),
  };
}
