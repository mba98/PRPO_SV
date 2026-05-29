'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useMotionSafe } from './useMotionSafe';

const SIZE_CLASSES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export default function AnimatedModal({ isOpen, onClose, title, children, size = 'md' }) {
  const backdropProps = useMotionSafe({
    initial: { opacity: 0 },
    animate: { opacity: 0.5 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 },
  });

  const panelProps = useMotionSafe({
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { duration: 0.2, ease: 'easeOut' },
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <motion.button
            type="button"
            aria-label="Close modal"
            className="absolute inset-0 bg-background/70 backdrop-blur-md"
            onClick={onClose}
            {...backdropProps}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            className={`relative z-10 w-full rounded-t-3xl border border-border bg-card p-6 shadow-2xl shadow-black/20 sm:rounded-3xl ${SIZE_CLASSES[size]} sm:max-h-[90vh] sm:overflow-y-auto`}
            {...panelProps}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="modal-title" className="text-lg font-bold text-foreground">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="btn-ghost"
              >
                ✕
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
