import { describe, expect, it } from 'vitest';
import { getVisibleNavItems, getVisibleSettingsNav } from '@/lib/navigation';
import { PORTAL_ROUTE_PATHS, SIDEBAR_ENTRY_PATHS } from '@/lib/appRoutes';
import { getDictionary } from '@/lib/i18n';
import { isNavItemActive, resolveActiveNavHref } from '@/lib/navActive';

describe('navigation permissions', () => {
  const adminPerms = ['admin.settings', 'view.all', 'pr.create'];

  it('shows dashboard for any authenticated user', () => {
    const items = getVisibleNavItems([]);
    expect(items.some((n) => n.href === '/dashboard')).toBe(true);
    const dash = items.find((n) => n.href === '/dashboard');
    expect(dash?.label).toBe(getDictionary('ar').nav.dashboard);
  });

  it('navigation labels use English when locale is en', () => {
    const items = getVisibleNavItems([], 'en');
    const dash = items.find((n) => n.href === '/dashboard');
    expect(dash?.label).toBe(getDictionary('en').nav.dashboard);
  });

  it('filters purchase requests by permission', () => {
    expect(getVisibleNavItems(['pr.create']).some((n) => n.href === '/purchase-requests')).toBe(
      true,
    );
    expect(getVisibleNavItems([]).some((n) => n.href === '/purchase-requests')).toBe(false);
  });

  it('shows purchase orders when user object has role po permissions', () => {
    const procurement = { permissions: [], role: { permissions: ['po.create'] } };
    expect(getVisibleNavItems(procurement).some((n) => n.href === '/purchase-orders')).toBe(true);
  });

  it('hides purchase orders without PO permissions', () => {
    const requester = { permissions: [], role: { permissions: ['pr.create'] } };
    expect(getVisibleNavItems(requester).some((n) => n.href === '/purchase-orders')).toBe(false);
  });

  it('shows settings links for admin', () => {
    const settings = getVisibleSettingsNav(adminPerms);
    expect(settings.some((s) => s.href === '/settings/sap-integration')).toBe(true);
    expect(settings.some((s) => s.href === '/settings/users')).toBe(false);
  });

  it('shows POs Ready for APRI for apinvoice.create users', () => {
    const nav = getVisibleNavItems(['apinvoice.create']);
    expect(
      nav.some((n) => n.href === '/purchase-orders/ready-for-ap-reserve-invoice'),
    ).toBe(true);
  });

  it('shows POs Ready for APRI for view.all users', () => {
    const nav = getVisibleNavItems(['view.all']);
    expect(
      nav.some((n) => n.href === '/purchase-orders/ready-for-ap-reserve-invoice'),
    ).toBe(true);
  });

  it('hides POs Ready for APRI without apinvoice.create or view.all', () => {
    const nav = getVisibleNavItems(['pr.create']);
    expect(
      nav.some((n) => n.href === '/purchase-orders/ready-for-ap-reserve-invoice'),
    ).toBe(false);
  });

  it('hides all settings links for requester-only user', () => {
    expect(getVisibleSettingsNav(['pr.create'])).toHaveLength(0);
  });

  it('shows users settings only with admin.users', () => {
    expect(getVisibleSettingsNav(['admin.users']).some((s) => s.href === '/settings/users')).toBe(
      true,
    );
    expect(getVisibleSettingsNav(['admin.settings']).some((s) => s.href === '/settings/users')).toBe(
      false,
    );
  });

  it('shows PRs Ready for PO for po.create or view.all', () => {
    expect(
      getVisibleNavItems(['po.create']).some((n) => n.href === '/purchase-requests/approved-for-po'),
    ).toBe(true);
    expect(
      getVisibleNavItems(['view.all']).some((n) => n.href === '/purchase-requests/approved-for-po'),
    ).toBe(true);
    expect(
      getVisibleNavItems(['pr.create']).some((n) => n.href === '/purchase-requests/approved-for-po'),
    ).toBe(false);
  });

  it('finance user sees PO nav with po.approve.finance', () => {
    const nav = getVisibleNavItems(['po.approve.finance']);
    expect(nav.some((n) => n.href === '/purchase-orders')).toBe(true);
  });

  it('procurement sees approved-for-po with po.create', () => {
    const nav = getVisibleNavItems(['po.create']);
    expect(nav.some((n) => n.href === '/purchase-requests/approved-for-po')).toBe(true);
    expect(nav.some((n) => n.href === '/purchase-orders')).toBe(true);
  });

  it('approved-for-po route activates only PRs Ready for PO nav item', () => {
    const nav = getVisibleNavItems(['po.create', 'pr.create']);
    const pathname = '/purchase-requests/approved-for-po';
    const active = resolveActiveNavHref(pathname, nav);
    expect(active).toBe('/purchase-requests/approved-for-po');
    expect(isNavItemActive(pathname, '/purchase-requests/approved-for-po', active)).toBe(true);
    expect(isNavItemActive(pathname, '/purchase-requests', active)).toBe(false);
  });

  it('purchase-requests list activates Purchase Requests only', () => {
    const nav = getVisibleNavItems(['pr.create', 'po.create']);
    const pathname = '/purchase-requests';
    const active = resolveActiveNavHref(pathname, nav);
    expect(active).toBe('/purchase-requests');
    expect(isNavItemActive(pathname, '/purchase-requests', active)).toBe(true);
    expect(isNavItemActive(pathname, '/purchase-requests/approved-for-po', active)).toBe(false);
  });

  it('PR detail activates Purchase Requests only', () => {
    const nav = getVisibleNavItems(['pr.create', 'po.create']);
    const pathname = '/purchase-requests/64b8c1a52f5b1b2c3d4e5f60';
    const active = resolveActiveNavHref(pathname, nav);
    expect(active).toBe('/purchase-requests');
    expect(isNavItemActive(pathname, '/purchase-requests', active)).toBe(true);
    expect(isNavItemActive(pathname, '/purchase-requests/approved-for-po', active)).toBe(false);
  });

  it('sidebar entries cover all list and settings routes', () => {
    const listAndSettings = PORTAL_ROUTE_PATHS.filter(
      (p) =>
        !p.includes('/create') &&
        !p.includes('/[id]') &&
        p !== '/dashboard',
    );
    for (const route of listAndSettings) {
      expect(SIDEBAR_ENTRY_PATHS).toContain(route);
    }
  });
});
