import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACCENT_PALETTE } from '@/lib/theme/themes';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n';

describe('TopBar controls — moved to Quick Actions menu', () => {
  it('LanguageSelector renders compact AR/EN toggle', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/ui/LanguageSelector.jsx'),
      'utf8',
    );
    expect(src).toContain('topbar-icon-btn');
    expect(src).toContain("'AR'");
    expect(src).toContain("'EN'");
  });

  it('AccentPalette supports embedded mode for quick menu', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/ui/AccentPalette.jsx'),
      'utf8',
    );
    expect(src).toContain('embedded');
    expect(src).toContain('accent-color-item');
    expect(ACCENT_PALETTE).toHaveLength(10);
  });

  it('QuickActionsMenu hosts theme controls instead of TopBar', () => {
    const topBar = fs.readFileSync(
      path.resolve(process.cwd(), 'components/layout/TopBar.jsx'),
      'utf8',
    );
    const quick = fs.readFileSync(
      path.resolve(process.cwd(), 'components/layout/QuickActionsMenu.jsx'),
      'utf8',
    );
    expect(topBar).toContain('QuickActionsMenu');
    expect(topBar).not.toContain('<AccentPalette');
    expect(quick).toContain('<AccentPalette');
    expect(quick).toContain('<SunMoonToggle');
    expect(quick).toContain('<LanguageSelector');
  });

  it('language store uses procurement-locale key', () => {
    const store = fs.readFileSync(
      path.resolve(process.cwd(), 'stores/languageStore.js'),
      'utf8',
    );
    expect(LOCALE_STORAGE_KEY).toBe('procurement-locale');
    expect(store).toContain(LOCALE_STORAGE_KEY);
  });
});
