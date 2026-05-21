'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useMotionSafe } from './useMotionSafe';

/**
 * Avoid SSR/hydration leaving content at opacity:0 (invisible white page).
 * Render a visible static wrapper until mounted, then run entrance animation.
 */
export default function AnimatedPageWrapper({ children, className = '' }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const motionProps = useMotionSafe({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.25, ease: 'easeOut' },
  });

  if (!mounted || Object.keys(motionProps).length === 0) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div className={className} {...motionProps}>
      {children}
    </motion.div>
  );
}
