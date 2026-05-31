import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('SunMoonToggle — animated sun/moon icon', () => {
  const toggle = fs.readFileSync(
    path.resolve(process.cwd(), 'components/ui/SunMoonToggle.jsx'),
    'utf8',
  );
  const quick = fs.readFileSync(
    path.resolve(process.cwd(), 'components/layout/QuickActionsMenu.jsx'),
    'utf8',
  );
  const css = fs.readFileSync(path.resolve(process.cwd(), 'app/globals.css'), 'utf8');

  it('QuickActionsMenu uses SunMoonToggle size sm without color dot', () => {
    expect(quick).toContain('<SunMoonToggle size="sm" />');
    expect(quick).not.toContain('rounded-full');
    expect(quick).not.toContain('backgroundColor');
  });

  it('SunMoonToggle renders svg with primary color', () => {
    expect(toggle).toContain('<svg');
    expect(toggle).toContain('fill="currentColor"');
    expect(toggle).toContain('sunMoon');
    expect(toggle).toContain('sunRays');
    expect(css).toContain('color: var(--primary)');
    expect(css).toContain('.sun-moon-toggle-light');
    expect(css).toContain('.sun-moon-toggle-dark');
  });

  it('light mode activates sun rays and dark mode shows moon', () => {
    expect(toggle).toContain('sun-moon-toggle-light');
    expect(toggle).toContain('sun-moon-toggle-dark');
    expect(css).toContain('.sun-moon-toggle-light svg .sunRay');
    expect(css).toContain('.sun-moon-toggle-dark svg .sunRay');
  });

  it('clicking toggle calls toggleMode from themeStore', () => {
    expect(toggle).toContain('toggleMode');
    expect(toggle).toContain('switchToLightMode');
    expect(toggle).toContain('switchToDarkMode');
  });
});
