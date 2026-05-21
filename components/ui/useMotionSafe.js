'use client';

import { useReducedMotion } from 'framer-motion';

export function useMotionSafe(animationProps) {
  const shouldReduceMotion = useReducedMotion();
  return shouldReduceMotion ? {} : animationProps;
}
