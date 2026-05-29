'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getEffectivePermissions } from '@/lib/effectivePermissions';
import { getVisibleNavItems, getVisibleSettingsNav } from '@/lib/navigation';
import { useI18n } from '@/lib/hooks/useI18n';

export default function Sidebar({ user }) {
  const pathname = usePathname();
  const { common, nav, locale } = useI18n();
  const permissions = getEffectivePermissions(user);
  const mainNav = getVisibleNavItems(permissions, locale);
  const settingsNav = getVisibleSettingsNav(permissions, locale);

  const linkClass = (href) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return active
      ? 'bg-primary text-primary-foreground shadow-lg'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground';
  };

  return (
    <aside className="sticky top-0 flex h-screen w-64 flex-col border-e border-border bg-card">
      <div className="border-b border-border px-5 py-5">
        <p className="text-sm font-bold tracking-wide text-foreground">{common.appName}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{user?.name}</p>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {mainNav.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`block min-h-10 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${linkClass(item.href)}`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        {settingsNav.length > 0 && (
          <>
            <p className="mb-2 mt-6 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {nav.settings}
            </p>
            <ul className="space-y-1">
              {settingsNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`block min-h-10 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${linkClass(item.href)}`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </nav>
    </aside>
  );
}
