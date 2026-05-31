'use client';

import { AnimatePresence, motion } from 'framer-motion';
import SidebarIdentity from './SidebarIdentity';
import SidebarNav from './SidebarNav';
import SidebarSignOut from './SidebarSignOut';
import { useI18n } from '@/lib/hooks/useI18n';
import { useMotionSafe } from '@/components/ui/useMotionSafe';

export default function MobileNav({ user, isOpen, onClose }) {
  const { common, isRtl } = useI18n();

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
