'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useMotionSafe } from './useMotionSafe';

const SIZE_CLASSES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

/**
 * @param {'center' | 'top'} placement — `top` aligns dialog below header (sign-out, alerts).
 */
export default function AnimatedModal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  placement = 'center',
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const backdropProps = useMotionSafe({
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 },
  });

  const panelProps = useMotionSafe({
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { duration: 0.2, ease: 'easeOut' },
  });

  const positionClass =
    placement === 'top'
      ? 'items-start justify-center px-4 pt-24'
      : 'items-center justify-center p-4';

  const modal = (
    <AnimatePresence>
      {isOpen && (
        <div
          className={`fixed inset-0 z-[9999] flex ${positionClass}`}
          dir="inherit"
        >
          <motion.button
            type="button"
            aria-label="Close modal"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            {...backdropProps}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            className={`relative z-10 w-full rounded-3xl border border-border bg-card p-6 shadow-2xl shadow-black/25 ${SIZE_CLASSES[size]} max-h-[calc(100vh-6rem)] overflow-y-auto`}
            {...panelProps}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="modal-title" className="text-lg font-bold text-foreground">
                {title}
              </h2>
              <button type="button" onClick={onClose} className="btn-ghost shrink-0">
                ✕
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  if (!mounted) return null;
  return createPortal(modal, document.body);
}
