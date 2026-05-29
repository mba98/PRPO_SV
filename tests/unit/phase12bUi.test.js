import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getDictionary, getDir, navLabel, statusLabel, LOCALE_STORAGE_KEY } from '@/lib/i18n';
import { ACCENT_THEMES } from '@/lib/theme/themes';

describe('Phase 12B — HRMS design system and bilingual UI', () => {
  it('LanguageSelector component exists', () => {
    const src = fs.readFileSync(path.resolve(process.cwd(), 'components/ui/LanguageSelector.jsx'), 'utf8');
    expect(src).toContain('setLocale');
    expect(src).toContain('ar');
    expect(src).toContain('en');
  });

  it('language store uses procurement-locale key', () => {
    const src = fs.readFileSync(path.resolve(process.cwd(), 'stores/languageStore.js'), 'utf8');
    expect(src).toContain('LOCALE_STORAGE_KEY');
    expect(LOCALE_STORAGE_KEY).toBe('procurement-locale');
  });

  it('Arabic sets dir rtl and English sets dir ltr', () => {
    expect(getDir('ar')).toBe('rtl');
    expect(getDir('en')).toBe('ltr');
  });

  it('layout bootstraps locale before hydration', () => {
    const layout = fs.readFileSync(path.resolve(process.cwd(), 'app/layout.js'), 'utf8');
    expect(layout).toContain('procurement-locale');
    expect(layout).toContain('document.documentElement.dir');
  });

  it('navigation labels switch language', () => {
    const item = { labelKey: 'dashboard' };
    expect(navLabel(item, 'ar')).toBe(getDictionary('ar').nav.dashboard);
    expect(navLabel(item, 'en')).toBe(getDictionary('en').nav.dashboard);
  });

  it('status labels switch language', () => {
    expect(statusLabel('Draft', 'ar')).toBe('مسودة');
    expect(statusLabel('Draft', 'en')).toBe('Draft');
  });

  it('theme selector still supports 7 colors', () => {
    expect(ACCENT_THEMES).toHaveLength(7);
  });

  it('Button component defines variants', () => {
    const src = fs.readFileSync(path.resolve(process.cwd(), 'components/ui/Button.jsx'), 'utf8');
    expect(src).toContain('primary');
    expect(src).toContain('secondary');
    expect(src).toContain('danger');
    expect(src).toContain('ghost');
  });

  it('PR list retains export and history', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/purchase-requests/PrListManager.jsx'),
      'utf8',
    );
    expect(src).toContain('exportExcel');
    expect(src).toContain('ApprovalHistoryDrawer');
  });

  it('settings guard avoids permission selector loops', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/settings/SettingsPageGuard.jsx'),
      'utf8',
    );
    expect(src).toContain('useEffectivePermissions');
    expect(src).not.toContain('getEffectivePermissions()');
  });

  it('globals define HRMS semantic tokens', () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), 'app/globals.css'), 'utf8');
    expect(css).toContain('--background');
    expect(css).toContain('--primary');
    expect(css).toContain('--card');
  });

  it('layout uses Cairo font', () => {
    const layout = fs.readFileSync(path.resolve(process.cwd(), 'app/layout.js'), 'utf8');
    expect(layout).toContain('Cairo');
    expect(layout).toContain('--font-cairo');
  });
});
