import { userHasEffectivePermission } from '@/lib/effectivePermissions.js';

export const PR_STATUS_DRAFT = 'Draft';
export const PR_STATUS_REJECTED = 'Rejected';
export const PR_STATUS_CREATING_IN_SAP = 'Creating in SAP';

const EDITABLE_STATUSES = new Set([PR_STATUS_DRAFT, PR_STATUS_REJECTED]);
const RESUBMITTABLE_STATUSES = new Set([PR_STATUS_REJECTED]);

export function normalizePrStatus(status) {
  if (status == null || status === '') return status;
  const value = String(status).trim();
  const lower = value.toLowerCase();
  if (lower === 'draft') return PR_STATUS_DRAFT;
  if (lower === 'rejected') return PR_STATUS_REJECTED;
  if (lower === 'creating in sap') return PR_STATUS_CREATING_IN_SAP;
  return value;
}

export function isEditablePrStatus(status) {
  return EDITABLE_STATUSES.has(normalizePrStatus(status));
}

export function isResubmittablePrStatus(status) {
  return RESUBMITTABLE_STATUSES.has(normalizePrStatus(status));
}

export function userCanProcurementEditPr(user) {
  return userHasEffectivePermission(user, 'pr.edit') || userHasEffectivePermission(user, 'pr.create');
}

export function userCanProcurementResubmitPr(user) {
  return userHasEffectivePermission(user, 'pr.resubmit') || userHasEffectivePermission(user, 'pr.create');
}

function passesPrEditGuards(pr) {
  if (!pr) return false;
  if (pr.sapPRDocEntry) return false;
  if (normalizePrStatus(pr.status) === PR_STATUS_CREATING_IN_SAP) return false;
  return true;
}

export function canEditPurchaseRequest(user, pr) {
  if (!passesPrEditGuards(pr)) return false;
  if (!isEditablePrStatus(pr.status)) return false;
  return userCanProcurementEditPr(user);
}

export function canResubmitPurchaseRequest(user, pr) {
  if (!passesPrEditGuards(pr)) return false;
  if (!isResubmittablePrStatus(pr.status)) return false;
  return userCanProcurementResubmitPr(user);
}

export function getPrEditForbiddenMessage(user, pr) {
  if (canEditPurchaseRequest(user, pr)) return null;
  if (!userCanProcurementEditPr(user)) {
    return 'You do not have permission to edit this purchase request';
  }
  if (pr?.sapPRDocEntry) {
    return 'Purchase request cannot be edited after SAP creation';
  }
  if (normalizePrStatus(pr?.status) === PR_STATUS_CREATING_IN_SAP) {
    return 'Purchase request cannot be edited while SAP creation is in progress';
  }
  return 'Only draft or rejected purchase requests can be edited';
}
