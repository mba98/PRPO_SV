import { describe, expect, it } from 'vitest';
import { getVisibleNavItems, getVisibleSettingsNav } from '@/lib/navigation';

describe('navigation permissions', () => {
  const adminPerms = ['admin.settings', 'view.all', 'pr.create'];

  it('shows dashboard for any authenticated user', () => {
    const nav = getVisibleNavItems([]);
    expect(nav.some((n) => n.href === '/dashboard')).toBe(true);
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
});
