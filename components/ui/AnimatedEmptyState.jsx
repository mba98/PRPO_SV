'use client';

import { motion, useReducedMotion } from 'framer-motion';

const DEFAULT_ICON = (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    className="h-10 w-10 text-muted-foreground"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 13.5h6m-9 4.5h12a1.5 1.5 0 001.5-1.5V9.621a1.5 1.5 0 00-.44-1.06l-3.622-3.622a1.5 1.5 0 00-1.06-.439H6a1.5 1.5 0 00-1.5 1.5v10.5A1.5 1.5 0 006 18z"
    />
  </svg>
);

export default function AnimatedEmptyState({
  icon,
  title,
  description,
  action,
}) {
  const shouldReduceMotion = useReducedMotion();

  const containerAnim = shouldReduceMotion
    ? { initial: false, animate: { opacity: 1, y: 0 } }
    : {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.35, delay: 0.1 },
      };

  const iconAnim = shouldReduceMotion
    ? {}
    : {
        animate: { y: [0, -6, 0] },
        transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
      };

  return (
    <motion.div
      {...containerAnim}
      className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-10 text-center"
    >
      <motion.div {...iconAnim} className="mb-3">
        {icon ?? DEFAULT_ICON}
      </motion.div>
      {title && (
        <p className="text-sm font-semibold text-foreground">{title}</p>
      )}
      {description && (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      )}
      {action?.label && (
        <button
          type="button"
          onClick={action.onClick}
          className="btn-primary mt-4 text-xs"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
}
