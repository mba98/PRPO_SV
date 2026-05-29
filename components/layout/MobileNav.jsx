'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { getEffectivePermissions } from '@/lib/effectivePermissions';
import { getVisibleNavItems, getVisibleSettingsNav } from '@/lib/navigation';
import { useI18n } from '@/lib/hooks/useI18n';
import { useMotionSafe } from '@/components/ui/useMotionSafe';

export default function MobileNav({ user, isOpen, onClose }) {
  const pathname = usePathname();
  const { common, nav, locale, isRtl } = useI18n();
  const permissions = getEffectivePermissions(user);
  const mainNav = getVisibleNavItems(permissions, locale);
  const settingsNav = getVisibleSettingsNav(permissions, locale);

  const slideFrom = isRtl ? '100%' : '-100%';
  const sideClass = isRtl ? 'end-0' : 'start-0';

  const backdropProps = useMotionSafe({
    initial: { opacity: 0 },
    animate: { opacity: 0.6 },
    exit: { opacity: 0 },
  });

  const panelProps = useMotionSafe({
    initial: { x: slideFrom },
    animate: { x: 0 },
    exit: { x: slideFrom },
    transition: { duration: 0.28, ease: 'easeOut' },
  });

  const linkClass = (href) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return active
      ? 'bg-primary text-primary-foreground shadow-lg'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <motion.button
            type="button"
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            aria-label={common.close}
            onClick={onClose}
            {...backdropProps}
          />
          <motion.aside
            className={`absolute ${sideClass} top-0 flex h-full w-[min(20rem,88vw)] flex-col border-border bg-card text-foreground shadow-2xl`}
            {...panelProps}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <p className="font-bold text-foreground">{common.appName}</p>
              <button
                type="button"
                onClick={onClose}
                className="btn-ghost min-h-10 min-w-10"
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
                      className={`block min-h-10 rounded-xl px-3 py-2.5 text-sm font-semibold ${linkClass(item.href)}`}
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
                          onClick={onClose}
                          className={`block min-h-10 rounded-xl px-3 py-2.5 text-sm font-semibold ${linkClass(item.href)}`}
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
