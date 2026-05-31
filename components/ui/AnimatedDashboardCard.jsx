'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { dashboard as dashI18n } from '@/lib/i18n';
import { useMotionSafe } from './useMotionSafe';

const toneClasses = {
  default: 'border-border bg-card',
  success: 'border-emerald-500/30 bg-card',
  warning: 'border-amber-500/30 bg-card',
  danger: 'border-destructive/30 bg-card',
  info: 'border-primary/30 bg-card',
};

export default function AnimatedDashboardCard({
  title,
  value,
  href,
  tone = 'default',
  loading = false,
}) {
  const motionProps = useMotionSafe({
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.25 },
  });

  const inner = (
    <motion.div
      className={`rounded-3xl border p-5 shadow-xl shadow-black/5 transition-shadow hover:shadow-2xl ${toneClasses[tone] || toneClasses.default}`}
      {...motionProps}
    >
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">
        {loading ? '—' : value ?? 0}
      </p>
      {href && (
        <p className="mt-3 text-xs font-semibold text-primary">{dashI18n.viewList} ←</p>
      )}
    </motion.div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-100"
      >
        {inner}
      </Link>
    );
  }

  return inner;
}
