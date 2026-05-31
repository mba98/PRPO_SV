import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACCENT_PALETTE } from '@/lib/theme/themes';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n';

describe('TopBar controls — compact HRMS reference style', () => {
  it('LanguageSelector renders compact AR/EN toggle, not wide pill labels', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/ui/LanguageSelector.jsx'),
      'utf8',
    );
    expect(src).toContain('topbar-icon-btn');
    expect(src).toContain("'AR'");
    expect(src).toContain("'EN'");
    expect(src).toContain("setLocale(isArabic ? 'en' : 'ar')");
    expect(src).not.toContain('lang-pill');
    expect(src).not.toContain('common.arabic');
    expect(src).not.toContain('common.english');
  });

  it('LanguageSelector toggles locale and uses procurement-locale storage via store', () => {
    const store = fs.readFileSync(
      path.resolve(process.cwd(), 'stores/languageStore.js'),
      'utf8',
    );
    expect(LOCALE_STORAGE_KEY).toBe('procurement-locale');
    expect(store).toContain(LOCALE_STORAGE_KEY);
    expect(store).toContain('setLocale');
  });

  it('AccentPalette uses rectangular accent-color-item, not rounded-full swatches', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/ui/AccentPalette.jsx'),
      'utf8',
    );
    const css = fs.readFileSync(path.resolve(process.cwd(), 'app/globals.css'), 'utf8');
    expect(src).toContain('accent-color-item');
    expect(src).toContain("'--color'");
    expect(src).toContain('topbar-icon-btn');
    expect(src).not.toContain('accent-swatch');
    expect(css).toContain('.accent-color-item::after');
    expect(css).toContain('border-radius: 6px');
  });

  it('AccentPalette includes all 10 required colors', () => {
    expect(ACCENT_PALETTE).toHaveLength(10);
    const expected = [
      '#e11d48',
      '#f472b6',
      '#fb923c',
      '#facc15',
      '#84cc16',
      '#10b981',
      '#0ea5e9',
      '#3b82f6',
      '#8b5cf6',
      '#a78bfa',
    ];
    expected.forEach((hex) => {
      expect(ACCENT_PALETTE.some((p) => p.hex === hex)).toBe(true);
    });
  });

  it('SunMoonToggle renders SVG and toggles theme mode', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/ui/SunMoonToggle.jsx'),
      'utf8',
    );
    expect(src).toContain('toggleMode');
    expect(src).toContain('sun-moon-svg');
    expect(src).toContain('topbar-icon-btn');
    expect(src).not.toContain('lightMode');
  });

  it('TopBar contains AccentPalette, SunMoonToggle, and LanguageSelector in order', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/layout/TopBar.jsx'),
      'utf8',
    );
    expect(src).toContain('topbar-controls');
    const jsx = src.slice(src.indexOf('topbar-controls'));
    expect(jsx).toContain('<AccentPalette');
    expect(jsx).toContain('<SunMoonToggle');
    expect(jsx).toContain('<LanguageSelector');
    expect(jsx.indexOf('<AccentPalette')).toBeLessThan(jsx.indexOf('<SunMoonToggle'));
    expect(jsx.indexOf('<SunMoonToggle')).toBeLessThan(jsx.indexOf('<LanguageSelector'));
  });

  it('key table components avoid hardcoded bg-white', () => {
    for (const file of [
      'components/settings/SettingsTable.jsx',
      'components/ui/DataTable.jsx',
    ]) {
      const src = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
      expect(src).not.toContain('bg-white');
    }
  });
});
