'use client';

import { motion } from 'framer-motion';
import { useMotionSafe } from './useMotionSafe';

export default function Card({ children, className = '', elevated = false, animate = true }) {
  const motionProps = useMotionSafe(
    animate
      ? {
          initial: { opacity: 0, y: 8 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.22 },
        }
      : {},
  );

  const base = elevated ? 'card-elevated' : 'card';

  if (Object.keys(motionProps).length > 0) {
    return (
      <motion.div className={`${base} ${className}`.trim()} {...motionProps}>
        {children}
      </motion.div>
    );
  }

  return <div className={`${base} ${className}`.trim()}>{children}</div>;
}
