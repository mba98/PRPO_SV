/**
 * PO eligibility for A/P Reserve Invoice creation.
 */

export function poIsReadyForApri(po, existingApri = null) {
  if (!po) return false;
  if (po.status !== 'Created in SAP') return false;
  if (po.sapPODocEntry == null) return false;
  if (existingApri) return false;
  return true;
}

export function filterPosReadyForApri(purchaseOrders, apriByPoId = new Map()) {
  return purchaseOrders.filter((po) => {
    const poId = po._id?.toString() || po.id;
    return poIsReadyForApri(po, apriByPoId.get(poId));
  });
}
