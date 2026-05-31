import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getDictionary } from '@/lib/i18n';
import { getPortalLogoSrc, PORTAL_LOGOS } from '@/lib/branding/portalLogos';

describe('Layout shell — logos, sidebar identity, quick actions', () => {
  it('TopBar does not render signed-in user text', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/layout/TopBar.jsx'),
      'utf8',
    );
    expect(src).not.toContain('signedInAs');
    expect(src).not.toContain('SignOut');
    expect(src).not.toContain('ConfirmDialog');
    expect(src).toContain('PortalBrandLogo');
    expect(src).toContain('QuickActionsMenu');
  });

  it('Sidebar renders identity and sign out at bottom', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/layout/Sidebar.jsx'),
      'utf8',
    );
    expect(src).toContain('SidebarIdentity');
    expect(src).toContain('SidebarSignOut');
    const identity = fs.readFileSync(
      path.resolve(process.cwd(), 'components/layout/SidebarIdentity.jsx'),
      'utf8',
    );
    expect(identity).toContain('signedInAs');
    expect(identity).toContain('roleLabel');
  });

  it('sign out opens confirmation modal via SidebarSignOut', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/layout/SidebarSignOut.jsx'),
      'utf8',
    );
    expect(src).toContain('ConfirmDialog');
    expect(src).toContain('setLogoutOpen(true)');
    expect(src).toContain('handleConfirmLogout');
    expect(src).not.toMatch(/onClick=\{handleLogout\}/);
  });

  it('brand logos switch by color mode', () => {
    expect(getPortalLogoSrc('sv', 'dark')).toBe(PORTAL_LOGOS.sv.dark);
    expect(getPortalLogoSrc('sv', 'light')).toBe(PORTAL_LOGOS.sv.light);
    expect(getPortalLogoSrc('spc', 'dark')).toBe(PORTAL_LOGOS.spc.dark);
    expect(getPortalLogoSrc('spc', 'light')).toBe(PORTAL_LOGOS.spc.light);
    const logo = fs.readFileSync(
      path.resolve(process.cwd(), 'components/layout/PortalBrandLogo.jsx'),
      'utf8',
    );
    expect(logo).toContain('useThemeStore');
    expect(logo).toContain('object-contain');
  });

  it('QuickActionsMenu contains theme controls', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/layout/QuickActionsMenu.jsx'),
      'utf8',
    );
    expect(src).toContain('AccentPalette');
    expect(src).toContain('SunMoonToggle');
    expect(src).toContain('LanguageSelector');
    expect(src).toContain('quick-menu-toggle');
    expect(src).toContain('quick-menu-bars');
    expect(src).toContain('quickActions');
  });

  it('quick menu CSS uses primary-colored bars', () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), 'app/globals.css'), 'utf8');
    expect(css).toContain('.quick-menu-bars span');
    expect(css).toContain('background: var(--primary)');
    expect(css).toContain('.quick-menu-toggle--open');
  });

  it('Arabic and English quick actions and role labels', () => {
    expect(getDictionary('en').common.quickActions).toBe('Quick actions');
    expect(getDictionary('ar').common.quickActions).toBe('الإعدادات السريعة');
    expect(getDictionary('en').common.roleLabel).toBe('Role');
    expect(getDictionary('ar').common.roleLabel).toBe('المسؤولية');
  });
});
