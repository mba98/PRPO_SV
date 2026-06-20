import { getEffectivePermissions } from '@/lib/effectivePermissions.js';
import {
  isLpEditableStatus,
  isPendingLpApprovalStatus,
  LP_STATUS,
  lpStatusesEqual,
} from '@/lib/localPurchaseStatus.js';
import { normalizeId } from '@/lib/normalizeId.js';

export const LP_CREATE_PERMISSION = 'lp.create';
export const LP_VIEW_ALL_PERMISSION = 'lp.view.all';
export const LP_CANCEL_PERMISSION = 'lp.cancel';
export const LP_APPROVAL_PERMISSIONS = ['lp.approve.pm', 'lp.approve.finance'];

export const LP_ACCESS_PERMISSIONS = [
  LP_CREATE_PERMISSION,
  ...LP_APPROVAL_PERMISSIONS,
  LP_VIEW_ALL_PERMISSION,
];

export const LP_LIST_PERMISSIONS = LP_ACCESS_PERMISSIONS;

export function userHasAnyLpApprovalPermission(permissions) {
  return LP_APPROVAL_PERMISSIONS.some((p) => permissions.includes(p));
}

export function userIsLpCreator(user, doc) {
  return normalizeId(doc?.createdBy) === normalizeId(user?._id || user?.id);
}

export function userCanAccessLpWorkflow(permissions) {
  return LP_ACCESS_PERMISSIONS.some((p) => permissions.includes(p));
}

export function userCanViewLocalPurchase(user, doc) {
  const permissions = getEffectivePermissions(user);
  if (permissions.includes(LP_VIEW_ALL_PERMISSION) || permissions.includes('admin.settings')) {
    return true;
  }
  if (userIsLpCreator(user, doc)) return true;
  if (isPendingLpApprovalStatus(doc.status)) {
    return userHasAnyLpApprovalPermission(permissions);
  }
  if (lpStatusesEqual(doc.status, LP_STATUS.COMPLETED)) {
    return userIsLpCreator(user, doc) || permissions.includes(LP_CREATE_PERMISSION);
  }
  return permissions.includes(LP_CREATE_PERMISSION) || userHasAnyLpApprovalPermission(permissions);
}

export function userCanEditLocalPurchase(user, doc) {
  const permissions = getEffectivePermissions(user);
  if (!isLpEditableStatus(doc.status)) return false;
  const isOwner = userIsLpCreator(user, doc);
  const adminOverride = permissions.includes('admin.settings');
  if (!isOwner && !adminOverride) return false;
  return permissions.includes(LP_CREATE_PERMISSION) || adminOverride;
}

export function userCanCancelLocalPurchase(user, doc) {
  const permissions = getEffectivePermissions(user);
  const norm = doc.status;
  const isOwner = userIsLpCreator(user, doc);
  const adminOverride = permissions.includes('admin.settings');

  if (lpStatusesEqual(norm, LP_STATUS.DRAFT) || lpStatusesEqual(norm, LP_STATUS.REJECTED)) {
    return isOwner && permissions.includes(LP_CANCEL_PERMISSION);
  }
  if (isPendingLpApprovalStatus(norm) || lpStatusesEqual(norm, LP_STATUS.COMPLETED)) {
    return adminOverride && permissions.includes(LP_CANCEL_PERMISSION);
  }
  return false;
}

export function userHasLpApprovalPermission(user, requiredPermission) {
  const permissions = getEffectivePermissions(user);
  return permissions.includes(requiredPermission);
}
