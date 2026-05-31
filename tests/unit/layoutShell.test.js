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

  it('TopBar locks SPC left and SV right regardless of locale', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/layout/TopBar.jsx'),
      'utf8',
    );
    expect(src).toContain('dir="ltr"');
    expect(src).toContain('topbar-logo-left');
    expect(src).toContain('topbar-logo-right');
    expect(src).toContain('topbar-logo-center');
    expect(src).toMatch(/brand="spc"/);
    expect(src).toMatch(/brand="sv"/);
    const spcIdx = src.indexOf('brand="spc"');
    const svIdx = src.indexOf('brand="sv"');
    const leftIdx = src.indexOf('topbar-logo-left');
    const rightIdx = src.indexOf('topbar-logo-right');
    expect(spcIdx).toBeGreaterThan(leftIdx);
    expect(svIdx).toBeGreaterThan(rightIdx);
    expect(src).not.toContain('flex-row-reverse');
    expect(src).not.toContain('justify-between');
  });

  it('QuickActionsMenu trigger is centered with compact popover', () => {
    const topBar = fs.readFileSync(
      path.resolve(process.cwd(), 'components/layout/TopBar.jsx'),
      'utf8',
    );
    expect(topBar).toContain('topbar-logo-center');
    const quick = fs.readFileSync(
      path.resolve(process.cwd(), 'components/layout/QuickActionsMenu.jsx'),
      'utf8',
    );
    expect(quick).toContain('quick-actions-menu');
    const css = fs.readFileSync(path.resolve(process.cwd(), 'app/globals.css'), 'utf8');
    expect(css).toContain('.quick-actions-popover');
    expect(css).toContain('left-1/2');
    expect(css).toContain('-translate-x-1/2');
    expect(css).toContain('w-[180px]');
    expect(css).not.toContain('min-w-[260px]');
  });

  it('quick menu trigger uses compact h-9 w-9 sizing', () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), 'app/globals.css'), 'utf8');
    expect(css).toContain('.quick-menu-toggle');
    expect(css).toContain('h-9 w-9');
    expect(css).toContain('width: 16px');
  });

  it('accent palette uses 2-row grid with compact h-6 w-6 swatches', () => {
    const palette = fs.readFileSync(
      path.resolve(process.cwd(), 'components/ui/AccentPalette.jsx'),
      'utf8',
    );
    expect(palette).toContain('grid-cols-5');
    expect(palette).toContain('h-6 w-6');
    expect(palette).toContain('rounded-md');
    expect(palette).not.toContain('accent-color-item');
    expect(palette).not.toContain('accent-palette-row');
    const css = fs.readFileSync(path.resolve(process.cwd(), 'app/globals.css'), 'utf8');
    expect(css).not.toContain('.accent-color-item');
  });

  it('dashboard cards use solid bg-card without washed overlays', () => {
    const card = fs.readFileSync(
      path.resolve(process.cwd(), 'components/ui/AnimatedDashboardCard.jsx'),
      'utf8',
    );
    expect(card).toContain('bg-card');
    expect(card).toContain('shadow-xl shadow-black/5');
    expect(card).toContain('text-foreground');
    expect(card).not.toContain('bg-emerald-50');
    expect(card).not.toContain('bg-destructive/10/50');
    expect(card).not.toMatch(/bg-\w+-50\/50/);
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
