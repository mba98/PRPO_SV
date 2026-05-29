'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { dashboard as dashI18n } from '@/lib/i18n';
import { useMotionSafe } from './useMotionSafe';

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

  const toneClasses = {
    default: 'border-border bg-card',
    success: 'border-emerald-200 bg-emerald-50/50',
    warning: 'border-amber-200 bg-amber-50/50',
    danger: 'border-rose-200 border border-destructive/30 bg-destructive/10/50',
    info: 'border-indigo-200 bg-indigo-50/50',
  };

  const inner = (
    <motion.div
      className={`rounded-xl border p-5 shadow-sm transition-shadow hover:shadow-md ${toneClasses[tone] || toneClasses.default}`}
      {...motionProps}
    >
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
        {loading ? '—' : value ?? 0}
      </p>
      {href && (
        <p className="mt-3 text-xs font-medium text-primary">{dashI18n.viewList} ←</p>
      )}
    </motion.div>
  );

  if (href) {
    return (
      <Link href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
        {inner}
      </Link>
    );
  }

  return inner;
}
