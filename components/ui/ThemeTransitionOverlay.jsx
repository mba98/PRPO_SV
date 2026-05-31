'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useUiTransitionStore } from '@/stores/uiTransitionStore';

const DURATION = 0.35;
const REDUCED_DURATION = 0.15;

export default function ThemeTransitionOverlay() {
  const transitionId = useUiTransitionStore((s) => s.transitionId);
  const reason = useUiTransitionStore((s) => s.reason);
  const reduceMotion = useReducedMotion();

  const duration = reduceMotion ? REDUCED_DURATION : DURATION;

  return (
    <AnimatePresence>
      {transitionId > 0 ? (
        <motion.div
          key={transitionId}
          className={`theme-transition-overlay theme-transition-overlay--${reason || 'mode'}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: reduceMotion ? 0.14 : reason === 'accent' ? 0.42 : 0.28 }}
          exit={{ opacity: 0 }}
          transition={{ duration, ease: 'easeOut' }}
          aria-hidden
        />
      ) : null}
    </AnimatePresence>
  );
}
