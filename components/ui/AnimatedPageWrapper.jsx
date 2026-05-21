'use client';

import { motion } from 'framer-motion';
import { useMotionSafe } from './useMotionSafe';

export default function AnimatedPageWrapper({ children, className = '' }) {
  const motionProps = useMotionSafe({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.25, ease: 'easeOut' },
  });

  return (
    <motion.div className={className} {...motionProps}>
      {children}
    </motion.div>
  );
}
