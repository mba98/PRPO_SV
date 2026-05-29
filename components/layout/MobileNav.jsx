'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { getEffectivePermissions } from '@/lib/effectivePermissions';
import { getVisibleNavItems, getVisibleSettingsNav } from '@/lib/navigation';
import { common, nav } from '@/lib/i18n';
import { useMotionSafe } from '@/components/ui/useMotionSafe';

export default function MobileNav({ user, isOpen, onClose }) {
  const pathname = usePathname();
  const permissions = getEffectivePermissions(user);
  const mainNav = getVisibleNavItems(permissions);
  const settingsNav = getVisibleSettingsNav(permissions);

  const backdropProps = useMotionSafe({
    initial: { opacity: 0 },
    animate: { opacity: 0.45 },
    exit: { opacity: 0 },
  });

  const panelProps = useMotionSafe({
    initial: { x: '100%' },
    animate: { x: 0 },
    exit: { x: '100%' },
    transition: { duration: 0.28, ease: 'easeOut' },
  });

  const linkClass = (href) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return active
      ? 'bg-brand-600 text-white'
      : 'text-slate-200 hover:bg-slate-800 hover:text-white';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <motion.button
            type="button"
            className="absolute inset-0 bg-slate-900"
            aria-label={common.close}
            onClick={onClose}
            {...backdropProps}
          />
          <motion.aside
            className="absolute start-0 top-0 flex h-full w-[min(20rem,88vw)] flex-col bg-slate-900 text-slate-100 shadow-xl"
            {...panelProps}
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <p className="font-semibold text-white">{common.appName}</p>
              <button
                type="button"
                onClick={onClose}
                className="min-h-10 min-w-10 rounded-lg text-slate-400 hover:bg-slate-800"
                aria-label={common.close}
              >
                ✕
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4">
              <ul className="space-y-1">
                {mainNav.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className={`block min-h-10 rounded-lg px-3 py-2.5 text-sm font-medium ${linkClass(item.href)}`}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
              {settingsNav.length > 0 && (
                <>
                  <p className="mb-2 mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {nav.settings}
                  </p>
                  <ul className="space-y-1">
                    {settingsNav.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={onClose}
                          className={`block min-h-10 rounded-lg px-3 py-2.5 text-sm font-medium ${linkClass(item.href)}`}
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </nav>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
