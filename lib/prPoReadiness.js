import { linesForVendor, vendorsFromPrLines } from '@/lib/sap/mappers/poToSap.js';
import { PO_STATUS, poStatusesEqual } from '@/lib/poStatus.js';

function isActivePoStatus(status) {
  return !poStatusesEqual(status, PO_STATUS.REJECTED);
}

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
    (o) => isActivePoStatus(o.status) && orderMatchesPr(o, prId),
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

/** PR has SAP PR identifiers required before portal PO creation. */
export function prHasCompleteSapPurchaseRequest(pr) {
  if (!pr) return false;
  if (pr.sapPRDocEntry == null) return false;
  const num = pr.sapPRDocNum;
  return num != null && String(num).trim() !== '';
}

/**
 * Mongo filter for PRs ready for first portal PO (base criteria; exclude linked PR ids separately).
 */
export function buildReadyForPoPrFilter() {
  return {
    status: 'Created in SAP',
    sapPRDocEntry: { $exists: true, $ne: null },
    sapPRDocNum: { $exists: true, $ne: null, $nin: [null, ''] },
  };
}

/**
 * Whether PR should appear on the approved-for-PO list (no portal PO yet).
 */
export function prIsEligibleForReadyForPoList(pr, purchaseOrders = []) {
  if (!pr) return false;
  if (pr.status !== 'Created in SAP') return false;
  if (!prHasCompleteSapPurchaseRequest(pr)) return false;
  if (prHasPortalPurchaseOrder(pr, purchaseOrders)) return false;
  return true;
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
      .filter((o) => isActivePoStatus(o.status))
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
  const activePOs = related.filter((o) => isActivePoStatus(o.status));
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
