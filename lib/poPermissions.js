import {
  getEffectivePermissions,
  userHasAnyEffectivePermission,
  userHasAdminSapRetryAccess,
} from '@/lib/effectivePermissions.js';
import {
  PO_READ_PERMISSIONS,
  PO_APPROVAL_PERMISSIONS,
  PO_CREATE_PERMISSIONS,
} from '@/lib/permissions.js';

export const PO_NAV_PERMISSIONS = PO_READ_PERMISSIONS;
export const PO_VIEW_PERMISSIONS = PO_READ_PERMISSIONS;
export const PO_PENDING_TAB_PERMISSIONS = [...PO_APPROVAL_PERMISSIONS, 'po.create', 'po.view', 'po.view.all', 'view.all'];
export const PO_CREATE_PERMISSIONS_EXPORT = PO_CREATE_PERMISSIONS;

export { PO_CREATE_PERMISSIONS, PO_READ_PERMISSIONS as PO_ACCESS_PERMISSIONS };

export function userHasAnyPoApprovalPermission(userOrPermissions) {
  const permissions = Array.isArray(userOrPermissions)
    ? userOrPermissions
    : getEffectivePermissions(userOrPermissions);
  return PO_APPROVAL_PERMISSIONS.some((p) => permissions.includes(p));
}

export function userCanAccessPoWorkflow(userOrPermissions) {
  const permissions = Array.isArray(userOrPermissions)
    ? userOrPermissions
    : getEffectivePermissions(userOrPermissions);
  return PO_READ_PERMISSIONS.some((p) => permissions.includes(p));
}

export function canViewPurchaseOrdersNav(user) {
  return userHasAnyEffectivePermission(user, PO_READ_PERMISSIONS);
}

export function canCreatePoFromPr(user) {
  return userHasAnyEffectivePermission(user, PO_CREATE_PERMISSIONS);
}

export function canRetrySapPurchaseOrder(user) {
  return userHasAdminSapRetryAccess(user);
}

export function isPrEligibleForPoCreation(pr) {
  if (!pr?.sapPRDocEntry) return false;
  return ['Created in SAP', 'Partially Ordered'].includes(pr.status);
}

export function canShowCreatePoAction(user, pr, { poReady = true } = {}) {
  if (!canCreatePoFromPr(user)) return false;
  if (!isPrEligibleForPoCreation(pr)) return false;
  return poReady !== false;
}
