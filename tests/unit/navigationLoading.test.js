import fs from 'fs';
import path from 'path';
import { beforeEach, describe, expect, it } from 'vitest';
import { useNavigationLoadingStore } from '@/stores/navigationLoadingStore';

const sidebarNavPath = path.resolve(process.cwd(), 'components/layout/SidebarNav.jsx');
const portalShellPath = path.resolve(process.cwd(), 'components/layout/PortalShell.jsx');
const mobileNavPath = path.resolve(process.cwd(), 'components/layout/MobileNav.jsx');

describe('navigationLoadingStore', () => {
  beforeEach(() => {
    useNavigationLoadingStore.setState({ isNavigating: false });
  });

  it('starts and stops navigation loading', () => {
    expect(useNavigationLoadingStore.getState().isNavigating).toBe(false);
    useNavigationLoadingStore.getState().startNavigation();
    expect(useNavigationLoadingStore.getState().isNavigating).toBe(true);
    useNavigationLoadingStore.getState().stopNavigation();
    expect(useNavigationLoadingStore.getState().isNavigating).toBe(false);
  });
});

describe('sidebar navigation loading wiring', () => {
  const sidebarNav = fs.readFileSync(sidebarNavPath, 'utf8');
  const portalShell = fs.readFileSync(portalShellPath, 'utf8');
  const mobileNav = fs.readFileSync(mobileNavPath, 'utf8');

  it('starts loading only when navigating to a different route', () => {
    expect(sidebarNav).toContain('startNavigation');
    expect(sidebarNav).toContain('isNavItemActive');
    expect(sidebarNav).toContain('handleNavClick');
  });

  it('stops loading when pathname changes in PortalShell', () => {
    expect(portalShell).toContain('stopNavigation');
    expect(portalShell).toContain('[pathname, stopNavigation]');
    expect(portalShell).toContain('isNavigating');
    expect(portalShell).toContain('PortalLoader');
  });

  it('mobile nav closes drawer via onNavigate on SidebarNav', () => {
    expect(mobileNav).toContain('<SidebarNav user={user} onNavigate={onClose} />');
  });
});
