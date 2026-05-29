/**
 * User-facing portal routes for navigation audit tests.
 * Detail/approve/create routes are reached via list rows or in-page actions.
 */
import { NAV_ITEMS, SETTINGS_NAV } from '@/lib/navigation.js';

export const PORTAL_ROUTE_PATHS = [
  '/dashboard',
  '/purchase-requests',
  '/purchase-requests/create',
  '/purchase-requests/approved-for-po',
  '/purchase-orders',
  '/purchase-orders/ready-for-ap-reserve-invoice',
  '/ap-reserve-invoices',
  '/settings/users',
  '/settings/roles',
  '/settings/approval-matrix',
  '/settings/email-groups',
  '/settings/sap-integration',
  '/settings/system-logs',
];

/** Routes that must appear in sidebar (main or settings) when permitted */
export const SIDEBAR_ENTRY_PATHS = [
  ...NAV_ITEMS.map((i) => i.href),
  ...SETTINGS_NAV.map((i) => i.href),
];
