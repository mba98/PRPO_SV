import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getDir } from '@/lib/i18n';
import {
  COLOR_MODE_STORAGE_KEY,
  DEFAULT_COLOR_MODE,
} from '@/lib/theme/documentTheme';
import { ACCENT_PALETTE, ACCENT_CSS_VARS, DEFAULT_ACCENT } from '@/lib/theme/themes';
import { buildThemeBootstrapScript } from '@/lib/theme/bootstrapScript';

describe('Phase 12C — light/dark, accent palette, login theme', () => {
  it('LoginForm uses semantic background and card tokens', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'app/login/LoginForm.jsx'),
      'utf8',
    );
    expect(src).toContain('login-page');
    expect(src).toContain('login-card');
    expect(src).toContain('text-foreground');
    expect(src).not.toContain('opacity: 0');
    expect(src).not.toContain('framer-motion');
  });

  it('login fallback uses login-page and login-card', () => {
    const src = fs.readFileSync(path.resolve(process.cwd(), 'app/login/page.js'), 'utf8');
    expect(src).toContain('login-page');
    expect(src).toContain('login-card');
    expect(src).not.toContain('bg-white');
  });

  it('themeStore supports light/dark mode and persistence', () => {
    const src = fs.readFileSync(path.resolve(process.cwd(), 'stores/themeStore.js'), 'utf8');
    const doc = fs.readFileSync(
      path.resolve(process.cwd(), 'lib/theme/documentTheme.js'),
      'utf8',
    );
    expect(src).toContain('setMode');
    expect(src).toContain('toggleMode');
    expect(doc).toContain(COLOR_MODE_STORAGE_KEY);
    expect(DEFAULT_COLOR_MODE).toBe('dark');
  });

  it('SunMoonToggle exists and toggles mode via themeStore', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/ui/SunMoonToggle.jsx'),
      'utf8',
    );
    expect(src).toContain('toggleMode');
    expect(src).toContain('sun-moon-toggle');
    expect(src).toContain('switchToLightMode');
  });

  it('AccentPalette includes rectangular items with CSS variable --color', () => {
    expect(ACCENT_PALETTE).toHaveLength(10);
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/ui/AccentPalette.jsx'),
      'utf8',
    );
    expect(src).toContain('backgroundColor');
    expect(src).toContain('grid-cols-5');
    expect(src).toContain('h-6 w-6');
    expect(src).not.toContain('accent-swatch');
    expect(ACCENT_PALETTE.some((p) => p.hex === '#e11d48')).toBe(true);
  });

  it('accent hex values match HRMS palette spec', () => {
    const expected = {
      rose: '#e11d48',
      pink: '#f472b6',
      orange: '#fb923c',
      yellow: '#facc15',
      lime: '#84cc16',
      emerald: '#10b981',
      sky: '#0ea5e9',
      blue: '#3b82f6',
      violet: '#8b5cf6',
      purple: '#a78bfa',
    };
    ACCENT_PALETTE.forEach((item) => {
      expect(item.hex).toBe(expected[item.id]);
      expect(ACCENT_CSS_VARS[item.id]['--accent-color']).toBe(expected[item.id]);
    });
  });

  it('bootstrap reads locale, color mode, and accent keys', () => {
    const script = buildThemeBootstrapScript();
    expect(script).toContain('procurement-locale');
    expect(script).toContain('procurement-color-mode');
    expect(script).toContain('procurement-accent-theme');
    expect(script).toContain('portal-accent-theme');
    expect(script).toContain('data-accent');
  });

  it('layout applies bootstrap before hydration', () => {
    const layout = fs.readFileSync(path.resolve(process.cwd(), 'app/layout.js'), 'utf8');
    expect(layout).toContain('buildThemeBootstrapScript');
  });

  it('globals define complete light and dark semantic tokens', () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), 'app/globals.css'), 'utf8');
    const tokens = [
      '--background',
      '--foreground',
      '--card',
      '--popover',
      '--muted',
      '--primary',
      '--destructive',
      '--border',
      '--input',
      '--ring',
    ];
    tokens.forEach((t) => expect(css).toContain(t));
    expect(css).toContain("[data-theme='dark']");
    expect(css).toContain("[data-theme='light']");
  });

  it('LanguageSelector uses compact AR/EN icon toggle', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/ui/LanguageSelector.jsx'),
      'utf8',
    );
    expect(src).toContain('topbar-icon-btn');
    expect(src).toContain("'AR'");
    expect(src).toContain("'EN'");
    expect(src).toContain('switchToEnglish');
    expect(src).toContain('switchToArabic');
  });

  it('Arabic sets dir rtl and English sets dir ltr', () => {
    expect(getDir('ar')).toBe('rtl');
    expect(getDir('en')).toBe('ltr');
  });

  it('QuickActionsMenu hosts AccentPalette, SunMoonToggle, and LanguageSelector', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/layout/QuickActionsMenu.jsx'),
      'utf8',
    );
    expect(src).toContain('<AccentPalette');
    expect(src).toContain('<SunMoonToggle');
    expect(src).toContain('<LanguageSelector');
    expect(src.indexOf('<AccentPalette')).toBeLessThan(src.indexOf('<SunMoonToggle'));
    expect(src.indexOf('<SunMoonToggle')).toBeLessThan(src.indexOf('<LanguageSelector'));
  });

  it('SettingsTable and DataTable avoid bg-white', () => {
    const settings = fs.readFileSync(
      path.resolve(process.cwd(), 'components/settings/SettingsTable.jsx'),
      'utf8',
    );
    const table = fs.readFileSync(
      path.resolve(process.cwd(), 'components/ui/DataTable.jsx'),
      'utf8',
    );
    expect(settings).not.toContain('bg-white');
    expect(table).not.toContain('bg-white');
    expect(settings).toContain('data-table');
  });

  it('Input uses input-field with card background in globals', () => {
    const input = fs.readFileSync(path.resolve(process.cwd(), 'components/ui/Input.jsx'), 'utf8');
    const css = fs.readFileSync(path.resolve(process.cwd(), 'app/globals.css'), 'utf8');
    expect(input).toContain('input-field');
    expect(css).toContain('bg-card');
    expect(css).toContain('text-foreground');
  });

  it('default accent is blue for backward compatibility with indigo migration', () => {
    expect(DEFAULT_ACCENT).toBe('blue');
  });
});
