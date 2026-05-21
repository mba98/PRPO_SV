'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getVisibleNavItems, getVisibleSettingsNav } from '@/lib/navigation';

export default function Sidebar({ user }) {
  const pathname = usePathname();
  const permissions = user?.permissions || [];
  const mainNav = getVisibleNavItems(permissions);
  const settingsNav = getVisibleSettingsNav(permissions);

  const linkClass = (href) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return active
      ? 'bg-brand-600 text-white'
      : 'text-slate-300 hover:bg-slate-800 hover:text-white';
  };

  return (
    <aside className="flex h-full w-60 flex-col bg-slate-900 text-slate-100">
      <div className="border-b border-slate-800 px-5 py-5">
        <p className="text-sm font-semibold tracking-wide text-white">Procurement Portal</p>
        <p className="mt-1 truncate text-xs text-slate-400">{user?.name}</p>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {mainNav.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${linkClass(item.href)}`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        {settingsNav.length > 0 && (
          <>
            <p className="mb-2 mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Settings
            </p>
            <ul className="space-y-1">
              {settingsNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${linkClass(item.href)}`}
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
