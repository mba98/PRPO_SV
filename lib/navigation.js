/**
 * Sidebar navigation filtered by user permissions.
 */

export const NAV_ITEMS = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    permissions: [],
  },
  {
    label: 'Purchase Requests',
    href: '/purchase-requests',
    permissions: ['pr.create', 'pr.approve.whs', 'pr.approve.pm', 'view.all'],
  },
  {
    label: 'Purchase Orders',
    href: '/purchase-orders',
    permissions: ['po.create', 'po.approve.pm', 'po.approve.finance', 'view.all'],
  },
  {
    label: 'A/P Reserve Invoices',
    href: '/ap-reserve-invoices',
    permissions: ['apinvoice.create', 'view.all'],
  },
];

export const SETTINGS_NAV = [
  { label: 'Users', href: '/settings/users', permissions: ['admin.users'] },
  { label: 'Roles', href: '/settings/roles', permissions: ['admin.roles'] },
  {
    label: 'Approval Matrix',
    href: '/settings/approval-matrix',
    permissions: ['admin.approval_matrix'],
  },
  { label: 'Email Groups', href: '/settings/email-groups', permissions: ['admin.settings'] },
  {
    label: 'SAP Integration',
    href: '/settings/sap-integration',
    permissions: ['admin.settings'],
  },
  {
    label: 'System Logs',
    href: '/settings/system-logs',
    permissions: ['admin.settings', 'view.all'],
  },
];

export function hasAnyPermission(userPermissions, required) {
  if (!required || required.length === 0) {
    return true;
  }
  return required.some((p) => userPermissions.includes(p));
}

export function getVisibleNavItems(userPermissions) {
  return NAV_ITEMS.filter((item) => hasAnyPermission(userPermissions, item.permissions));
}

export function getVisibleSettingsNav(userPermissions) {
  return SETTINGS_NAV.filter((item) => hasAnyPermission(userPermissions, item.permissions));
}
