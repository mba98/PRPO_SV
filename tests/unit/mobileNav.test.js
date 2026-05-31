import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('MobileNav — RTL drawer direction', () => {
  const mobileNav = fs.readFileSync(
    path.resolve(process.cwd(), 'components/layout/MobileNav.jsx'),
    'utf8',
  );
  const topBar = fs.readFileSync(
    path.resolve(process.cwd(), 'components/layout/TopBar.jsx'),
    'utf8',
  );

  it('Arabic RTL uses physical right-0 and positive slide offset when closed', () => {
    expect(mobileNav).toContain('isRtl');
    expect(mobileNav).toContain("'100%'");
    expect(mobileNav).toContain('right-0');
    expect(mobileNav).toContain('border-l');
    expect(mobileNav).not.toContain('end-0');
  });

  it('English LTR uses physical left-0 and negative slide offset when closed', () => {
    expect(mobileNav).toContain("'-100%'");
    expect(mobileNav).toContain('left-0');
    expect(mobileNav).toContain('border-r');
    expect(mobileNav).not.toContain('start-0');
  });

  it('open state animates panel to x 0', () => {
    expect(mobileNav).toContain('animate: { x: 0 }');
    expect(mobileNav).not.toContain('-translate-x-full');
    expect(mobileNav).not.toContain('translate-x-full');
  });

  it('overlay closes drawer on click', () => {
    expect(mobileNav).toContain('bg-black/50');
    expect(mobileNav).toContain('onClick={onClose}');
    expect(mobileNav).toContain('backdrop-blur-sm');
  });

  it('drawer uses compact width and fixed positioning', () => {
    expect(mobileNav).toContain('w-[280px]');
    expect(mobileNav).toContain('max-w-[85vw]');
    expect(mobileNav).toContain('fixed top-0');
    expect(mobileNav).toContain('h-screen');
  });

  it('TopBar keeps SV on physical right and SPC on physical left', () => {
    expect(topBar).toContain('dir="ltr"');
    expect(topBar).toContain('topbar-logo-right');
    expect(topBar).toContain('brand="sv"');
    expect(topBar).toContain('topbar-logo-left');
    expect(topBar).toContain('brand="spc"');
  });
});
