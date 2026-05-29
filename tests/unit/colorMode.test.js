import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  COLOR_MODE_STORAGE_KEY,
  DEFAULT_COLOR_MODE,
} from '@/stores/colorModeStore';
import { ACCENT_THEMES } from '@/lib/theme/themes';

describe('Color mode — light/dark portal theme', () => {
  it('ColorModeSelector exists with light and dark actions', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/ui/ColorModeSelector.jsx'),
      'utf8',
    );
    expect(src).toContain('setColorMode');
    expect(src).toContain("'light'");
    expect(src).toContain("'dark'");
    expect(src).toContain('useColorModeStore');
  });

  it('persists mode in procurement-color-mode localStorage key', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'stores/colorModeStore.js'),
      'utf8',
    );
    expect(COLOR_MODE_STORAGE_KEY).toBe('procurement-color-mode');
    expect(src).toContain(COLOR_MODE_STORAGE_KEY);
    expect(src).toContain('localStorage.setItem');
    expect(DEFAULT_COLOR_MODE).toBe('dark');
  });

  it('applies dark class and data-theme on document', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'stores/colorModeStore.js'),
      'utf8',
    );
    expect(src).toContain("classList.toggle('dark'");
    expect(src).toContain("setAttribute('data-theme'");
  });

  it('layout bootstraps color mode before hydration', () => {
    const layout = fs.readFileSync(path.resolve(process.cwd(), 'app/layout.js'), 'utf8');
    expect(layout).toContain('procurement-color-mode');
    expect(layout).toContain("classList.toggle('dark'");
    expect(layout).toContain('data-theme');
  });

  it('TopBar includes ColorModeSelector next to language and accent', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/layout/TopBar.jsx'),
      'utf8',
    );
    expect(src).toContain('ColorModeSelector');
    expect(src).toContain('LanguageSelector');
    expect(src).toContain('ThemeSelector');
    const jsx = src.slice(src.indexOf('return ('));
    const colorIdx = jsx.indexOf('<ColorModeSelector');
    const langIdx = jsx.indexOf('<LanguageSelector');
    const themeIdx = jsx.indexOf('<ThemeSelector');
    expect(colorIdx).toBeGreaterThan(-1);
    expect(langIdx).toBeGreaterThan(colorIdx);
    expect(themeIdx).toBeGreaterThan(langIdx);
  });

  it('Arabic and English labels for light/dark mode', () => {
    const ar = fs.readFileSync(path.resolve(process.cwd(), 'lib/i18n/ar.js'), 'utf8');
    const en = fs.readFileSync(path.resolve(process.cwd(), 'lib/i18n/en.js'), 'utf8');
    expect(ar).toContain('نهاري');
    expect(ar).toContain('ليلي');
    expect(en).toContain('lightMode: \'Light\'');
    expect(en).toContain('darkMode: \'Dark\'');
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

  it('seven accent themes still defined', () => {
    expect(ACCENT_THEMES).toHaveLength(7);
  });

  it('language store and selector still present alongside color mode', () => {
    const lang = fs.readFileSync(
      path.resolve(process.cwd(), 'components/ui/LanguageSelector.jsx'),
      'utf8',
    );
    expect(lang).toContain('setLocale');
    const providers = fs.readFileSync(
      path.resolve(process.cwd(), 'components/providers/AppProviders.jsx'),
      'utf8',
    );
    expect(providers).toContain('initColorMode');
    expect(providers).toContain('initLocale');
    expect(providers).toContain('initTheme');
  });
});
