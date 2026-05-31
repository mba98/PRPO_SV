import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Theme controls motion and Sun/Moon visibility', () => {
  it('SunMoonToggle uses currentColor and primary accent color', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/ui/SunMoonToggle.jsx'),
      'utf8',
    );
    const css = fs.readFileSync(path.resolve(process.cwd(), 'app/globals.css'), 'utf8');
    expect(src).toContain('fill="currentColor"');
    expect(src).toContain('aria-label');
    expect(src).toContain('switchToLightMode');
    expect(css).toContain('color: var(--primary)');
    expect(css).toContain('.sun-moon-toggle--dark');
  });

  it('ThemeTransitionOverlay exists and respects reduced motion', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/ui/ThemeTransitionOverlay.jsx'),
      'utf8',
    );
    expect(src).toContain('theme-transition-overlay');
    expect(src).toContain('useReducedMotion');
    expect(src).toContain('pointer-events');
  });

  it('setAccent triggers UI transition in themeStore', () => {
    const src = fs.readFileSync(path.resolve(process.cwd(), 'stores/themeStore.js'), 'utf8');
    expect(src).toContain("triggerTransition('accent')");
  });

  it('setMode triggers UI transition in themeStore', () => {
    const src = fs.readFileSync(path.resolve(process.cwd(), 'stores/themeStore.js'), 'utf8');
    expect(src).toContain("triggerTransition('mode')");
  });

  it('setLocale triggers UI transition in languageStore', () => {
    const src = fs.readFileSync(path.resolve(process.cwd(), 'stores/languageStore.js'), 'utf8');
    expect(src).toContain("triggerTransition('locale')");
  });

  it('reduced motion uses shorter overlay duration', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/ui/ThemeTransitionOverlay.jsx'),
      'utf8',
    );
    expect(src).toContain('REDUCED_DURATION');
    expect(src).toContain('reduceMotion');
  });

  it('LanguageSelector remains compact AR/EN toggle', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/ui/LanguageSelector.jsx'),
      'utf8',
    );
    expect(src).toContain("'AR'");
    expect(src).toContain("'EN'");
    expect(src).toContain('topbar-icon-btn');
  });

  it('AccentPalette keeps rectangular accent-color-item blocks', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/ui/AccentPalette.jsx'),
      'utf8',
    );
    expect(src).toContain('accent-color-item');
    expect(src).not.toContain('accent-swatch');
  });

  it('AppProviders mounts ThemeTransitionOverlay', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/providers/AppProviders.jsx'),
      'utf8',
    );
    expect(src).toContain('ThemeTransitionOverlay');
  });

  it('uiTransitionStore exposes triggerTransition', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'stores/uiTransitionStore.js'),
      'utf8',
    );
    expect(src).toContain('triggerTransition');
    expect(src).toContain('transitionId');
  });
});
