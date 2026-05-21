/**
 * Canonical permission strings for RBAC (matches seed and spec).
 */
export const ALL_PERMISSIONS = [
  'pr.create',
  'pr.approve.whs',
  'pr.approve.pm',
  'po.create',
  'po.approve.pm',
  'po.approve.finance',
  'apinvoice.create',
  'items.create',
  'admin.users',
  'admin.roles',
  'admin.approval_matrix',
  'admin.settings',
  'view.all',
];

export const PERMISSION_LABELS = {
  'pr.create': 'Create purchase requests',
  'pr.approve.whs': 'Approve PR — warehouse',
  'pr.approve.pm': 'Approve PR — project manager',
  'po.create': 'Create purchase orders',
  'po.approve.pm': 'Approve PO — project manager',
  'po.approve.finance': 'Approve PO — finance',
  'apinvoice.create': 'Create A/P reserve invoices',
  'items.create': 'Create SAP items',
  'admin.users': 'Manage users',
  'admin.roles': 'Manage roles',
  'admin.approval_matrix': 'Manage approval matrix',
  'admin.settings': 'Admin settings',
  'view.all': 'View all documents',
};
