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

  it('shows settings links for admin', () => {
    const settings = getVisibleSettingsNav(adminPerms);
    expect(settings.some((s) => s.href === '/settings/sap-integration')).toBe(true);
    expect(settings.some((s) => s.href === '/settings/users')).toBe(false);
  });
});
