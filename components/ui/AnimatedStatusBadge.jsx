'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { statusLabel } from '@/lib/i18n';
import { useMotionSafe } from './useMotionSafe';

const STATUS_STYLES = {
  Draft: 'bg-slate-100 text-slate-700',
  Approved: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-100 text-red-800',
  'Creating in SAP': 'bg-blue-100 text-blue-800',
  'Created in SAP': 'bg-emerald-100 text-emerald-800',
  'Failed to Create in SAP': 'bg-rose-100 text-rose-800',
  'Ready for AP Reserve Invoice': 'bg-violet-100 text-violet-800',
  Completed: 'bg-emerald-100 text-emerald-800',
};

function getStatusClass(status) {
  if (STATUS_STYLES[status]) {
    return STATUS_STYLES[status];
  }
  if (status?.includes('Pending')) {
    return 'bg-amber-100 text-amber-800';
  }
  return 'bg-slate-100 text-slate-700';
}

export default function AnimatedStatusBadge({ status }) {
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
        {statusLabel(status)}
      </motion.span>
    </AnimatePresence>
  );
}
