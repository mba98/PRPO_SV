import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  COLOR_MODE_STORAGE_KEY,
  DEFAULT_COLOR_MODE,
} from '@/lib/theme/documentTheme';
import { ACCENT_PALETTE } from '@/lib/theme/themes';

describe('Color mode — light/dark portal theme', () => {
  it('themeStore persists mode with procurement-color-mode key', () => {
    const src = fs.readFileSync(path.resolve(process.cwd(), 'stores/themeStore.js'), 'utf8');
    const doc = fs.readFileSync(
      path.resolve(process.cwd(), 'lib/theme/documentTheme.js'),
      'utf8',
    );
    expect(COLOR_MODE_STORAGE_KEY).toBe('procurement-color-mode');
    expect(doc).toContain(COLOR_MODE_STORAGE_KEY);
    expect(src).toContain('setMode');
    expect(src).toContain('toggleMode');
    expect(DEFAULT_COLOR_MODE).toBe('dark');
  });

  it('applies dark class and data-theme on document', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'lib/theme/documentTheme.js'),
      'utf8',
    );
    expect(src).toContain("classList.toggle('dark'");
    expect(src).toContain("setAttribute('data-theme'");
  });

  it('layout bootstraps color mode before hydration', () => {
    const layout = fs.readFileSync(path.resolve(process.cwd(), 'app/layout.js'), 'utf8');
    expect(layout).toContain('buildThemeBootstrapScript');
    const bootstrap = fs.readFileSync(
      path.resolve(process.cwd(), 'lib/theme/bootstrapScript.js'),
      'utf8',
    );
    expect(bootstrap).toContain('procurement-color-mode');
  });

  it('SunMoonToggle toggles theme mode', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/ui/SunMoonToggle.jsx'),
      'utf8',
    );
    expect(src).toContain('toggleMode');
    expect(src).not.toContain('ColorModeSelector');
  });

  it('Arabic and English labels for light/dark aria', () => {
    const ar = fs.readFileSync(path.resolve(process.cwd(), 'lib/i18n/ar.js'), 'utf8');
    const en = fs.readFileSync(path.resolve(process.cwd(), 'lib/i18n/en.js'), 'utf8');
    expect(ar).toContain('التبديل إلى الوضع النهاري');
    expect(ar).toContain('التبديل إلى الوضع الليلي');
    expect(en).toContain('switchToLightMode');
    expect(en).toContain('switchToDarkMode');
  });

  it('SettingsTable uses semantic table tokens not bg-white', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/settings/SettingsTable.jsx'),
      'utf8',
    );
    expect(src).toContain('data-table');
    expect(src).not.toContain('bg-white');
    expect(src).toContain('border-border');
    expect(src).toContain('bg-card');
  });

  it('DataTable uses data-table class not hardcoded white', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/ui/DataTable.jsx'),
      'utf8',
    );
    expect(src).toContain('data-table');
    expect(src).not.toContain('bg-white');
  });

  it('Input primitive uses bg-card semantic field', () => {
    const src = fs.readFileSync(path.resolve(process.cwd(), 'components/ui/Input.jsx'), 'utf8');
    expect(src).toContain('input-field');
    const css = fs.readFileSync(path.resolve(process.cwd(), 'app/globals.css'), 'utf8');
    expect(css).toContain('bg-card');
    expect(css).toContain('text-foreground');
  });

  it('tailwind uses class-based dark mode', () => {
    const cfg = fs.readFileSync(path.resolve(process.cwd(), 'tailwind.config.js'), 'utf8');
    expect(cfg).toContain("darkMode: 'class'");
  });

  it('accent palette has 10 colors', () => {
    expect(ACCENT_PALETTE).toHaveLength(10);
  });

  it('AppProviders initializes unified theme store', () => {
    const providers = fs.readFileSync(
      path.resolve(process.cwd(), 'components/providers/AppProviders.jsx'),
      'utf8',
    );
    expect(providers).toContain('initTheme');
    expect(providers).not.toContain('initColorMode');
    expect(providers).toContain('initLocale');
  });
});
