import { userHasEffectivePermission } from '@/lib/effectivePermissions.js';
import { PO_STATUS, normalizePoStatus } from '@/lib/poStatus.js';

export const PO_EDIT_FORBIDDEN_MESSAGE =
  'PO cannot be edited after approval workflow has started.';

function isProcurement(user) {
  return userHasEffectivePermission(user, 'po.edit') || userHasEffectivePermission(user, 'po.create');
}

function canResubmit(user) {
  return userHasEffectivePermission(user, 'po.resubmit') || userHasEffectivePermission(user, 'po.create');
}

/** True when any approval-matrix step was approved (PM, OM, or Finance). */
export function hasAnyApprovedApprovalStep(approvalHistory = []) {
  return approvalHistory.some((entry) => entry.action === 'Approved');
}

function passesPoEditGuards(po) {
  if (!po) return false;
  if (po.sapPODocEntry) return false;
  const status = normalizePoStatus(po.status);
  if (status === PO_STATUS.CREATING_IN_SAP) return false;
  return true;
}

/**
 * Procurement (po.create) may edit a PO only before the first approval or after rejection.
 */
export function canEditPurchaseOrder(user, po, approvalHistory = []) {
  if (!isProcurement(user)) return false;
  if (!passesPoEditGuards(po)) return false;

  const status = normalizePoStatus(po.status);

  if (status === PO_STATUS.REJECTED || status === PO_STATUS.DRAFT) {
    return true;
  }

  if (status === PO_STATUS.PENDING_PM && !hasAnyApprovedApprovalStep(approvalHistory)) {
    return true;
  }

  return false;
}

export function canResubmitPurchaseOrder(user, po, approvalHistory = []) {
  if (!canResubmit(user)) return false;
  if (!passesPoEditGuards(po)) return false;
  if (normalizePoStatus(po.status) !== PO_STATUS.REJECTED) return false;
  return canEditPurchaseOrder(user, po, approvalHistory);
}

export function getPoEditForbiddenMessage(user, po, approvalHistory = []) {
  if (canEditPurchaseOrder(user, po, approvalHistory)) return null;
  if (!isProcurement(user)) {
    return 'You do not have permission to edit this purchase order';
  }
  return PO_EDIT_FORBIDDEN_MESSAGE;
}
