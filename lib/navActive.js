/**
 * Pick the single most specific nav href that matches the current pathname.
 */
export function resolveActiveNavHref(pathname, navItems = []) {
  if (!pathname || !navItems.length) return null;

  const matches = navItems.filter((item) => {
    const href = item.href;
    if (!href) return false;
    if (href === '/dashboard') return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  });

  if (!matches.length) return null;

  return matches.sort((a, b) => b.href.length - a.href.length)[0].href;
}

export function isNavItemActive(pathname, href, activeHref) {
  if (!href || !activeHref) return false;
  return href === activeHref;
}
