'use client';

import { motion } from 'framer-motion';
import { useMotionSafe } from './useMotionSafe';

export default function AnimatedTableContainer({ children, className = '', animate = true }) {
  const motionProps = useMotionSafe(
    animate
      ? {
          initial: { opacity: 0, y: 6 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.22 },
        }
      : {},
  );

  const inner = (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
      {children}
    </div>
  );

  if (Object.keys(motionProps).length === 0) {
    return <div className={`table-scroll ${className}`.trim()}>{inner}</div>;
  }

  return (
    <motion.div className={`table-scroll ${className}`.trim()} {...motionProps}>
      {inner}
    </motion.div>
  );
}
