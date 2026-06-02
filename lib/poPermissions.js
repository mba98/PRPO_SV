import { getEffectivePermissions, userHasAnyEffectivePermission } from '@/lib/effectivePermissions.js';

export const PO_NAV_PERMISSIONS = [
  'po.create',
  'po.approve.pm',
  'po.approve.finance',
  'view.all',
];

export const PO_CREATE_PERMISSIONS = ['po.create', 'view.all'];
export const PO_RETRY_SAP_PERMISSIONS = ['po.approve.finance', 'admin.settings', 'view.all'];

export function canViewPurchaseOrdersNav(user) {
  return userHasAnyEffectivePermission(user, PO_NAV_PERMISSIONS);
}

export function canCreatePoFromPr(user) {
  return userHasAnyEffectivePermission(user, PO_CREATE_PERMISSIONS);
}

export function canRetrySapPurchaseOrder(user) {
  return userHasAnyEffectivePermission(user, PO_RETRY_SAP_PERMISSIONS);
}

/**
 * PR is eligible for portal PO creation (SAP PR exists, correct lifecycle status).
 */
export function isPrEligibleForPoCreation(pr) {
  if (!pr?.sapPRDocEntry) return false;
  return ['Created in SAP', 'Partially Ordered'].includes(pr.status);
}

export function canShowCreatePoAction(user, pr, { poReady = true } = {}) {
  if (!canCreatePoFromPr(user)) return false;
  if (!isPrEligibleForPoCreation(pr)) return false;
  return poReady !== false;
}
