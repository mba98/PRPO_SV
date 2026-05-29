import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACCENT_THEMES, THEME_STORAGE_KEY } from '@/lib/theme/themes';
import { getVisibleNavItems } from '@/lib/navigation';
import { nav, statusLabel, login } from '@/lib/i18n';

describe('Phase 12 — Arabic RTL and theme UI', () => {
  it('root layout sets lang=ar and dir=rtl', () => {
    const layout = fs.readFileSync(path.resolve(process.cwd(), 'app/layout.js'), 'utf8');
    expect(layout).toMatch(/lang=["']ar["']/);
    expect(layout).toMatch(/dir=["']rtl["']/);
  });

  it('navigation exposes Arabic dashboard label', () => {
    const items = getVisibleNavItems([]);
    const dash = items.find((n) => n.href === '/dashboard');
    expect(dash?.label).toBe(nav.dashboard);
  });

  it('theme selector supports 7 accent colors', () => {
    expect(ACCENT_THEMES).toHaveLength(7);
    const ids = ACCENT_THEMES.map((t) => t.id);
    expect(ids).toEqual(['indigo', 'blue', 'emerald', 'amber', 'rose', 'violet', 'slate']);
  });

  it('theme store persists accent in localStorage', () => {
    const src = fs.readFileSync(path.resolve(process.cwd(), 'stores/themeStore.js'), 'utf8');
    expect(src).toContain('THEME_STORAGE_KEY');
    expect(src).toContain('localStorage.setItem');
    expect(src).toContain('localStorage.getItem');
    expect(THEME_STORAGE_KEY).toBe('portal-accent-theme');
  });

  it('status labels map to Arabic', () => {
    expect(statusLabel('Draft')).toBe('مسودة');
    expect(statusLabel('Created in SAP')).toBe('تم الإنشاء في SAP');
    expect(statusLabel('Pending Finance Approval')).toContain('المالية');
  });

  it('login form uses Arabic labels', () => {
    const src = fs.readFileSync(path.resolve(process.cwd(), 'app/login/LoginForm.jsx'), 'utf8');
    expect(src).toContain('loginAr');
    expect(src).toContain('from \'@/lib/i18n\'');
    expect(login.username).toBe('اسم المستخدم');
  });

  it('PR list exports Excel and uses AnimatedTabs', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/purchase-requests/PrListManager.jsx'),
      'utf8',
    );
    expect(src).toContain('exportExcel');
    expect(src).toContain('AnimatedTabs');
    expect(src).toContain('ApprovalHistoryDrawer');
  });

  it('detail views keep comments/attachments/history tabs', () => {
    for (const file of [
      'components/purchase-requests/PrDetailView.jsx',
      'components/purchase-orders/PoDetailView.jsx',
      'components/ap-reserve-invoices/ApriDetailView.jsx',
    ]) {
      const src = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
      expect(src).toContain("'attachments'");
      expect(src).toContain("'comments'");
      expect(src).toContain("'history'");
    }
  });

  it('PR detail hides approve link unless canApprove in source', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/purchase-requests/PrDetailView.jsx'),
      'utf8',
    );
    expect(src).toContain('canApprove');
    expect(src).toMatch(/canApprove\s*&&/);
  });

  it('settings pages use Arabic PageHeader via i18n', () => {
    const users = fs.readFileSync(
      path.resolve(process.cwd(), 'app/(portal)/settings/users/page.js'),
      'utf8',
    );
    expect(users).toContain('settings.usersTitle');
  });

  it('theme provider initializes without selector loops', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/providers/ThemeProvider.jsx'),
      'utf8',
    );
    expect(src).toContain('initTheme');
    expect(src).not.toContain('getEffectivePermissions');
  });
});
