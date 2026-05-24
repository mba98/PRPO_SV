/**
 * Sidebar navigation filtered by user permissions.
 */
import { getEffectivePermissions } from '@/lib/effectivePermissions.js';

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
    label: 'POs Ready for APRI',
    href: '/purchase-orders/ready-for-ap-reserve-invoice',
    permissions: ['apinvoice.create', 'view.all'],
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

function resolvePermissions(userOrPermissions) {
  if (Array.isArray(userOrPermissions)) {
    return userOrPermissions;
  }
  return getEffectivePermissions(userOrPermissions);
}

export function getVisibleNavItems(userOrPermissions) {
  const permissions = resolvePermissions(userOrPermissions);
  return NAV_ITEMS.filter((item) => hasAnyPermission(permissions, item.permissions));
}

export function getVisibleSettingsNav(userOrPermissions) {
  const permissions = resolvePermissions(userOrPermissions);
  return SETTINGS_NAV.filter((item) => hasAnyPermission(permissions, item.permissions));
}
