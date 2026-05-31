import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getDictionary } from '@/lib/i18n';

describe('Logout confirmation and PortalLoader', () => {
  it('PortalLoader renders animated words SV PR PO Portal', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/ui/PortalLoader.jsx'),
      'utf8',
    );
    expect(src).toContain('portal-loader-text');
    expect(src).toContain('portal-loader-word');
    expect(src).not.toContain('portal-loader-card');
    expect(src).toContain("'SV'");
    expect(src).toContain("'PR'");
    expect(src).toContain("'PO'");
    expect(src).toContain("'Portal'");
  });

  it('PortalLoader CSS uses var(--primary) for animated words', () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), 'app/globals.css'), 'utf8');
    expect(css).toContain('.portal-loader-word');
    expect(css).toContain('color: var(--primary)');
    expect(css).toContain('portal-loader-spin');
  });

  it('TopBar opens ConfirmDialog before logout', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/layout/TopBar.jsx'),
      'utf8',
    );
    expect(src).toContain('ConfirmDialog');
    expect(src).toContain('setLogoutOpen(true)');
    expect(src).toContain('handleConfirmLogout');
    expect(src).not.toMatch(/onClick=\{handleLogout\}/);
    expect(src).toContain('logoutLoading');
  });

  it('ConfirmDialog supports cancel and confirm with loading guard', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/ui/ConfirmDialog.jsx'),
      'utf8',
    );
    expect(src).toContain('onClose');
    expect(src).toContain('onConfirm');
    expect(src).toContain('if (loading) return');
    expect(src).toContain('AnimatedModal');
  });

  it('logout is invoked from confirm handler not sign out click', () => {
    const topBar = fs.readFileSync(
      path.resolve(process.cwd(), 'components/layout/TopBar.jsx'),
      'utf8',
    );
    expect(topBar).toContain('await logout()');
    const confirmIdx = topBar.indexOf('handleConfirmLogout');
    const openIdx = topBar.indexOf('setLogoutOpen(true)');
    expect(confirmIdx).toBeGreaterThan(-1);
    expect(openIdx).toBeGreaterThan(-1);
    expect(openIdx).toBeLessThan(confirmIdx);
  });

  it('Arabic auth confirmation labels exist', () => {
    const ar = getDictionary('ar');
    expect(ar.auth.confirmSignOutTitle).toBe('تأكيد تسجيل الخروج');
    expect(ar.auth.confirmSignOutMessage).toContain('تسجيل الخروج');
    expect(ar.common.cancel).toBe('إلغاء');
  });

  it('English auth confirmation labels exist', () => {
    const en = getDictionary('en');
    expect(en.auth.confirmSignOutTitle).toBe('Confirm sign out');
    expect(en.auth.confirmSignOutMessage).toContain('sign out');
    expect(en.common.cancel).toBe('Cancel');
  });

  it('route loading uses single root loading.js without nested portal loader', () => {
    const root = fs.readFileSync(path.resolve(process.cwd(), 'app/loading.js'), 'utf8');
    expect(root).toContain('PortalLoader');
    expect(root).toContain('fullScreen');
    const portalPath = path.resolve(process.cwd(), 'app/(portal)/loading.js');
    expect(fs.existsSync(portalPath)).toBe(false);
  });

  it('PortalLoader CSS has no card box styles', () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), 'app/globals.css'), 'utf8');
    expect(css).toContain('.portal-loader-text');
    expect(css).not.toContain('.portal-loader-card');
  });

  it('AppProviders or layout exports ConfirmDialog via TopBar integration', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/ui/index.js'),
      'utf8',
    );
    expect(src).toContain('ConfirmDialog');
    expect(src).toContain('PortalLoader');
  });
});
