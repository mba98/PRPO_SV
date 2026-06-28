/**
 * Canonical permission strings for RBAC — backed by lib/permissionRegistry.js
 */
import {
  ACTIVE_PERMISSION_KEYS,
  ALL_REGISTRY_KEYS,
  buildPermissionGroups,
  buildPermissionLabels,
  PERMISSION_REGISTRY,
} from '@/lib/permissionRegistry.js';

export { PERMISSION_REGISTRY, ACTIVE_PERMISSION_KEYS };

/** All keys including legacy (for validation/migration) */
export const ALL_PERMISSIONS = ALL_REGISTRY_KEYS;

export const PERMISSION_LABELS = buildPermissionLabels();

/** Grouped permissions for the roles settings UI */
export const PERMISSION_GROUPS = buildPermissionGroups();

export const PR_APPROVAL_PERMISSIONS = ['pr.approve.whs', 'pr.approve.pm'];
export const PO_APPROVAL_PERMISSIONS = ['po.approve.pm', 'po.approve.om', 'po.approve.finance'];

/** Read access to PO list/detail APIs */
export const PO_READ_PERMISSIONS = [
  'po.view',
  'po.view.all',
  'po.create',
  ...PO_APPROVAL_PERMISSIONS,
  'view.all',
];

/** @deprecated Use PO_READ_PERMISSIONS */
export const PO_ACCESS_PERMISSIONS = PO_READ_PERMISSIONS;
export const PO_NAV_PERMISSIONS = PO_READ_PERMISSIONS;
export const PO_VIEW_PERMISSIONS = PO_READ_PERMISSIONS;

export const PO_PENDING_TAB_PERMISSIONS = [...PO_APPROVAL_PERMISSIONS, 'po.create', 'po.view', 'po.view.all'];

/** Procurement may create PO from PR — view.all is read-only and excluded */
export const PO_CREATE_PERMISSIONS = ['po.create'];

export const PO_RETRY_SAP_ROUTE_PERMISSIONS = [
  'po.create',
  ...PO_APPROVAL_PERMISSIONS,
  'po.retry.sap',
  'sap.po.retry',
  'admin.settings',
];

export const PR_READ_PERMISSIONS = [
  'pr.view',
  'pr.view.all',
  'pr.create',
  ...PR_APPROVAL_PERMISSIONS,
  'view.all',
];

export const APRI_PROCUREMENT_PERMISSIONS = ['apri.create', 'apri.create.sap', 'apinvoice.create'];

export const APRI_READ_PERMISSIONS = [
  'apri.view',
  'apri.view.all',
  ...APRI_PROCUREMENT_PERMISSIONS,
  'apri.approve.whs',
  'pr.approve.whs',
  'view.all',
];

/** Sync superset for route/nav guards (includes current seed matrix permission). */
export const APRI_VIEW_PERMISSIONS = APRI_READ_PERMISSIONS;

export const APRI_MATRIX_APPROVER_PERMISSIONS = ['apri.approve.whs', 'pr.approve.whs'];

export const APRI_APPROVE_ROUTE_PERMISSIONS = [
  'apri.approve.whs',
  'pr.approve.whs',
  ...APRI_PROCUREMENT_PERMISSIONS,
];

export function userIsApriProcurement(permissions) {
  return APRI_PROCUREMENT_PERMISSIONS.some((p) => permissions.includes(p));
}

export function userIsApriMatrixApprover(permissions) {
  return APRI_MATRIX_APPROVER_PERMISSIONS.some((p) => permissions.includes(p));
}

export const LP_APPROVAL_PERMISSIONS = ['lp.approve.pm', 'lp.approve.finance'];

export const LP_ACCESS_PERMISSIONS = ['lp.create', 'lp.view', ...LP_APPROVAL_PERMISSIONS, 'lp.view.all'];

export const LP_LIST_PERMISSIONS = LP_ACCESS_PERMISSIONS;

export const PORTAL_DASHBOARD_PERMISSIONS = [
  'pr.create',
  'pr.view',
  ...PR_APPROVAL_PERMISSIONS,
  'po.create',
  'po.view',
  ...PO_APPROVAL_PERMISSIONS,
  ...APRI_PROCUREMENT_PERMISSIONS,
  ...LP_ACCESS_PERMISSIONS,
  'view.all',
];

export const ROLES_PICKLIST_PERMISSIONS = [
  'admin.roles',
  'admin.users',
  'admin.approval_matrix',
  'admin.settings',
];

export const USERS_PICKLIST_PERMISSIONS = ['admin.users', 'admin.settings'];

export const SYSTEM_LOGS_PERMISSIONS = ['admin.system_logs', 'admin.settings'];

export const PR_EDIT_PERMISSIONS = ['pr.edit', 'pr.create'];
export const PO_EDIT_PERMISSIONS = ['po.edit', 'po.create'];
export const PR_SUBMIT_PERMISSIONS = ['pr.submit', 'pr.create'];
export const PO_SUBMIT_PERMISSIONS = ['po.submit', 'po.create'];
export const PR_RESUBMIT_PERMISSIONS = ['pr.resubmit', 'pr.create'];
export const PO_RESUBMIT_PERMISSIONS = ['po.resubmit', 'po.create'];
