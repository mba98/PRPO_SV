'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useMotionSafe } from './useMotionSafe';

export default function AnimatedDrawer({ isOpen, onClose, title, children, width = '24rem' }) {
  const backdropProps = useMotionSafe({
    initial: { opacity: 0 },
    animate: { opacity: 0.4 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 },
  });

  const panelProps = useMotionSafe({
    initial: { x: '-100%', opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: '-100%', opacity: 0 },
    transition: { duration: 0.28, ease: 'easeOut' },
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-start">
          <motion.button
            type="button"
            aria-label="Close drawer"
            className="absolute inset-0 bg-card"
            onClick={onClose}
            {...backdropProps}
          />
          <motion.aside
            className="relative z-10 flex h-full flex-col bg-card shadow-xl"
            style={{ width, maxWidth: '100vw' }}
            {...panelProps}
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">{children}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
