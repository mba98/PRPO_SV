import { getEffectivePermissions } from '@/lib/effectivePermissions.js';

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

export function isPrRequester(user, pr) {
  if (!user || !pr) return false;
  const requesterId = pr.requester?._id?.toString?.() || pr.requester?.toString?.() || pr.requester;
  const userId = user._id?.toString?.() || user.id?.toString?.();
  return Boolean(requesterId && userId && requesterId === userId);
}

export function userCanAdminEditPr(user) {
  const permissions = getEffectivePermissions(user);
  return permissions.includes('view.all') || permissions.includes('admin.settings');
}

export function canEditPurchaseRequest(user, pr) {
  if (!pr) return false;
  if (pr.sapPRDocEntry) return false;
  if (normalizePrStatus(pr.status) === PR_STATUS_CREATING_IN_SAP) return false;
  if (!isEditablePrStatus(pr.status)) return false;
  return isPrRequester(user, pr) || userCanAdminEditPr(user);
}

export function canResubmitPurchaseRequest(user, pr) {
  if (!pr) return false;
  if (!isPrRequester(user, pr)) return false;
  if (pr.sapPRDocEntry) return false;
  if (normalizePrStatus(pr.status) === PR_STATUS_CREATING_IN_SAP) return false;
  return isResubmittablePrStatus(pr.status);
}

export function getPrEditForbiddenMessage(user, pr) {
  if (canEditPurchaseRequest(user, pr)) return null;
  if (!isPrRequester(user, pr) && !userCanAdminEditPr(user)) {
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
