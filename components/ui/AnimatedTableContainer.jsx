'use client';

import { motion } from 'framer-motion';
import { useMotionSafe } from './useMotionSafe';

export default function AnimatedTableContainer({ children, className = '' }) {
  const motionProps = useMotionSafe({
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.22 },
  });

  return (
    <motion.div className={`table-scroll ${className}`} {...motionProps}>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {children}
      </div>
    </motion.div>
  );
}
