/**
 * Canonical permission strings for RBAC (matches seed and spec).
 */
export const ALL_PERMISSIONS = [
  'pr.create',
  'pr.approve.whs',
  'pr.approve.pm',
  'po.create',
  'po.approve.pm',
  'po.approve.om',
  'po.approve.finance',
  'apinvoice.create',
  'items.create',
  'admin.users',
  'admin.roles',
  'admin.approval_matrix',
  'admin.settings',
  'view.all',
];

/** Grouped permissions for the roles settings UI */
export const PERMISSION_GROUPS = [
  {
    id: 'pr',
    label: 'Purchase Requests (PR)',
    permissions: ['pr.create', 'pr.approve.whs', 'pr.approve.pm'],
  },
  {
    id: 'po',
    label: 'Purchase Orders (PO)',
    permissions: ['po.create', 'po.approve.pm', 'po.approve.om', 'po.approve.finance'],
  },
  {
    id: 'apri',
    label: 'A/P Reserve Invoices (APRI)',
    permissions: ['apinvoice.create'],
  },
  {
    id: 'items',
    label: 'Items',
    permissions: ['items.create'],
  },
  {
    id: 'admin',
    label: 'Admin',
    permissions: ['admin.users', 'admin.roles', 'admin.approval_matrix', 'admin.settings'],
  },
  {
    id: 'view',
    label: 'View',
    permissions: ['view.all'],
  },
];

export const PR_APPROVAL_PERMISSIONS = ['pr.approve.whs', 'pr.approve.pm'];
export const PO_APPROVAL_PERMISSIONS = ['po.approve.pm', 'po.approve.om', 'po.approve.finance'];

/** Permissions that grant access to PO list/detail/approval APIs (not po.create alone for approvers). */
export const PO_ACCESS_PERMISSIONS = ['po.create', ...PO_APPROVAL_PERMISSIONS, 'view.all'];

/** Any authenticated workflow role may load the dashboard APIs. */
export const PORTAL_DASHBOARD_PERMISSIONS = [
  'pr.create',
  ...PR_APPROVAL_PERMISSIONS,
  'po.create',
  ...PO_APPROVAL_PERMISSIONS,
  'apinvoice.create',
  'view.all',
];

/** Permissions allowed on picklist APIs (roles dropdown) */
export const ROLES_PICKLIST_PERMISSIONS = [
  'admin.roles',
  'admin.users',
  'admin.approval_matrix',
  'admin.settings',
];

/** Permissions allowed on user picklist APIs */
export const USERS_PICKLIST_PERMISSIONS = ['admin.users', 'admin.settings'];

export const PERMISSION_LABELS = {
  'pr.create': 'Create purchase requests',
  'pr.approve.whs': 'Approve PR — warehouse',
  'pr.approve.pm': 'Approve PR — project manager',
  'po.create': 'Create purchase orders',
  'po.approve.pm': 'Approve PO — project manager',
  'po.approve.om': 'Approve PO — operation manager',
  'po.approve.finance': 'Approve PO — finance',
  'apinvoice.create': 'Create A/P reserve invoices',
  'items.create': 'Create SAP items',
  'admin.users': 'Manage users',
  'admin.roles': 'Manage roles',
  'admin.approval_matrix': 'Manage approval matrix',
  'admin.settings': 'Admin settings',
  'view.all': 'View all documents',
};
