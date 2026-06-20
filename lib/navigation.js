/**
 * Sidebar navigation filtered by user permissions.
 */
import { getEffectivePermissions } from '@/lib/effectivePermissions.js';
import { navLabel } from '@/lib/i18n';
import { APRI_VIEW_PERMISSIONS, LP_LIST_PERMISSIONS } from '@/lib/permissions.js';
import { PO_VIEW_PERMISSIONS } from '@/lib/poPermissions.js';

export const NAV_ITEMS = [
  { labelKey: 'dashboard', href: '/dashboard', permissions: [] },
  {
    labelKey: 'purchaseRequests',
    href: '/purchase-requests',
    permissions: ['pr.create', 'pr.approve.whs', 'pr.approve.pm', 'view.all'],
  },
  {
    labelKey: 'prsReadyForPo',
    href: '/purchase-requests/approved-for-po',
    permissions: ['po.create', 'view.all'],
  },
  {
    labelKey: 'purchaseOrders',
    href: '/purchase-orders',
    permissions: PO_VIEW_PERMISSIONS,
  },
  {
    labelKey: 'posReadyForApri',
    href: '/purchase-orders/ready-for-ap-reserve-invoice',
    permissions: ['apinvoice.create', 'view.all'],
  },
  {
    labelKey: 'apReserveInvoices',
    href: '/ap-reserve-invoices',
    permissions: APRI_VIEW_PERMISSIONS,
  },
  {
    labelKey: 'localPurchases',
    href: '/local-purchases',
    permissions: LP_LIST_PERMISSIONS,
  },
];

export const SETTINGS_NAV = [
  { labelKey: 'users', href: '/settings/users', permissions: ['admin.users'] },
  { labelKey: 'roles', href: '/settings/roles', permissions: ['admin.roles'] },
  { labelKey: 'permissions', href: '/settings/permissions', permissions: ['admin.roles'] },
  {
    labelKey: 'approvalMatrix',
    href: '/settings/approval-matrix',
    permissions: ['admin.approval_matrix'],
  },
  { labelKey: 'emailGroups', href: '/settings/email-groups', permissions: ['admin.settings'] },
  {
    labelKey: 'sapIntegration',
    href: '/settings/sap-integration',
    permissions: ['admin.settings'],
  },
  {
    labelKey: 'systemLogs',
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

export function getVisibleNavItems(userOrPermissions, locale = 'ar') {
  const permissions = resolvePermissions(userOrPermissions);
  return NAV_ITEMS.filter((item) => hasAnyPermission(permissions, item.permissions)).map(
    (item) => ({
      ...item,
      label: navLabel(item, locale),
    }),
  );
}

export function getVisibleSettingsNav(userOrPermissions, locale = 'ar') {
  const permissions = resolvePermissions(userOrPermissions);
  return SETTINGS_NAV.filter((item) => hasAnyPermission(permissions, item.permissions)).map(
    (item) => ({
      ...item,
      label: navLabel(item, locale),
    }),
  );
}
