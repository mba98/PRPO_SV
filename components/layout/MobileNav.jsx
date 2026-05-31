'use client';

import { AnimatePresence, motion } from 'framer-motion';
import SidebarIdentity from './SidebarIdentity';
import SidebarNav from './SidebarNav';
import SidebarSignOut from './SidebarSignOut';
import { useI18n } from '@/lib/hooks/useI18n';
import { useMotionSafe } from '@/components/ui/useMotionSafe';

export default function MobileNav({ user, isOpen, onClose }) {
  const { common, locale, isRtl } = useI18n();
  const rtl =
    isRtl ||
    (typeof document !== 'undefined' && document.documentElement.dir === 'rtl');

  const slideClosed = rtl ? '100%' : '-100%';

  const backdropProps = useMotionSafe({
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.25, ease: 'easeOut' },
  });

  const panelProps = useMotionSafe({
    initial: { x: slideClosed },
    animate: { x: 0 },
    exit: { x: slideClosed },
    transition: { duration: 0.25, ease: 'easeOut' },
  });

  const panelPositionClass = rtl
    ? 'right-0 border-l border-border'
    : 'left-0 border-r border-border';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <motion.button
            type="button"
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            aria-label={common.close}
            onClick={onClose}
            {...backdropProps}
          />
          <motion.aside
            data-locale={locale}
            data-rtl={rtl ? 'true' : 'false'}
            className={`fixed top-0 z-50 flex h-screen w-[280px] max-w-[85vw] flex-col bg-card text-foreground shadow-2xl ${panelPositionClass}`}
            {...panelProps}
          >
            <div className="flex justify-end border-b border-border px-3 py-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-ghost min-h-10 min-w-10"
                aria-label={common.close}
              >
                ✕
              </button>
            </div>
            <SidebarIdentity user={user} />
            <SidebarNav user={user} onNavigate={onClose} />
            <div className="border-t border-border p-3">
              <SidebarSignOut />
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
