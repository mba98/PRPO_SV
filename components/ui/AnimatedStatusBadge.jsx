'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useI18n } from '@/lib/hooks/useI18n';
import { useMotionSafe } from './useMotionSafe';

const STATUS_STYLES = {
  Draft: 'bg-muted text-muted-foreground',
  Approved: 'bg-emerald-500/20 text-emerald-300',
  Rejected: 'bg-destructive/20 text-rose-300',
  'Creating in SAP': 'bg-blue-500/20 text-blue-300',
  'Created in SAP': 'bg-emerald-500/20 text-emerald-300',
  'Failed to Create in SAP': 'bg-destructive/20 text-rose-300',
  'Ready for AP Reserve Invoice': 'bg-violet-500/20 text-violet-300',
  Completed: 'bg-emerald-500/20 text-emerald-300',
};

function getStatusClass(status) {
  if (STATUS_STYLES[status]) {
    return STATUS_STYLES[status];
  }
  if (status?.includes('Pending')) {
    return 'bg-amber-500/20 text-amber-300';
  }
  return 'bg-muted text-muted-foreground';
}

export default function AnimatedStatusBadge({ status }) {
  const { statusLabel: labelFor } = useI18n();
  const isCreating = status === 'Creating in SAP';
  const baseClass = getStatusClass(status);

  const mountProps = useMotionSafe({
    initial: { scale: 0.85, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    transition: { duration: 0.2 },
  });

  const pulseProps = useMotionSafe(
    isCreating
      ? {
          animate: { opacity: [1, 0.5, 1] },
          transition: { duration: 1.2, repeat: Infinity },
        }
      : {},
  );

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={status}
        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${baseClass}`}
        {...mountProps}
        {...pulseProps}
      >
        {labelFor(status)}
      </motion.span>
    </AnimatePresence>
  );
}
