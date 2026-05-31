import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACCENT_THEMES, THEME_STORAGE_KEY } from '@/lib/theme/themes';
import { getVisibleNavItems } from '@/lib/navigation';
import { nav, statusLabel, login } from '@/lib/i18n';

describe('Phase 12 — Arabic RTL and theme UI', () => {
  it('root layout bootstraps locale and uses AppProviders', () => {
    const layout = fs.readFileSync(path.resolve(process.cwd(), 'app/layout.js'), 'utf8');
    expect(layout).toContain('buildThemeBootstrapScript');
    expect(layout).toContain('AppProviders');
    const bootstrap = fs.readFileSync(
      path.resolve(process.cwd(), 'lib/theme/bootstrapScript.js'),
      'utf8',
    );
    expect(bootstrap).toContain('procurement-locale');
  });

  it('navigation exposes Arabic dashboard label', () => {
    const items = getVisibleNavItems([]);
    const dash = items.find((n) => n.href === '/dashboard');
    expect(dash?.label).toBe(nav.dashboard);
  });

  it('accent palette supports 10 HRMS colors', () => {
    expect(ACCENT_THEMES).toHaveLength(10);
    const ids = ACCENT_THEMES.map((t) => t.id);
    expect(ids).toContain('rose');
    expect(ids).toContain('blue');
    expect(ids).toContain('purple');
  });

  it('theme store persists accent in localStorage', () => {
    const src = fs.readFileSync(path.resolve(process.cwd(), 'stores/themeStore.js'), 'utf8');
    expect(src).toContain('ACCENT_STORAGE_KEY');
    expect(src).toContain('localStorage.setItem');
    expect(src).toContain('localStorage.getItem');
    expect(THEME_STORAGE_KEY).toBe('procurement-accent-theme');
  });

  it('status labels map to Arabic', () => {
    expect(statusLabel('Draft')).toBe('مسودة');
    expect(statusLabel('Created in SAP')).toBe('تم الإنشاء في SAP');
    expect(statusLabel('Pending Finance Approval')).toContain('المالية');
  });

  it('login form uses bilingual i18n hook', () => {
    const src = fs.readFileSync(path.resolve(process.cwd(), 'app/login/LoginForm.jsx'), 'utf8');
    expect(src).toContain('useI18n');
    expect(src).toContain('LanguageSelector');
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
    expect(users).toContain('SectionPageHeader');
    expect(users).toContain('usersTitle');
  });

  it('app providers initialize theme and locale', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/providers/AppProviders.jsx'),
      'utf8',
    );
    expect(src).toContain('initTheme');
    expect(src).toContain('initLocale');
    expect(src).not.toContain('getEffectivePermissions');
  });
});
