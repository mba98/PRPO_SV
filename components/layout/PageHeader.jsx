'use client';

import { motion } from 'framer-motion';
import { useMotionSafe } from '@/components/ui/useMotionSafe';

export default function PageHeader({ title, description, actions }) {
  const motionProps = useMotionSafe({
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.22 },
  });

  return (
    <motion.div
      className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      {...motionProps}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </motion.div>
  );
}
