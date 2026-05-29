'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMotionSafe } from './useMotionSafe';
import { useI18n } from '@/lib/hooks/useI18n';

export default function AnimatedFilterPanel({
  children,
  title,
  defaultOpen = true,
  className = '',
}) {
  const { common } = useI18n();
  const panelTitle = title ?? common.applyFilters;
  const [open, setOpen] = useState(defaultOpen);
  const panelProps = useMotionSafe({
    initial: { height: 0, opacity: 0 },
    animate: { height: 'auto', opacity: 1 },
    exit: { height: 0, opacity: 0 },
    transition: { duration: 0.22 },
  });

  return (
    <div className={`card ${className}`}>
      <button
        type="button"
        className="flex w-full min-h-10 items-center justify-between gap-2 text-sm font-semibold text-foreground lg:hidden"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {panelTitle}
        <span aria-hidden>{open ? '▾' : '◂'}</span>
      </button>
      <div className="hidden lg:block">{children}</div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="mt-3 lg:hidden" {...panelProps}>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
