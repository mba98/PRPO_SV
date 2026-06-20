'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useI18n } from '@/lib/hooks/useI18n';
import { useMotionSafe } from './useMotionSafe';
import { PO_STATUS, normalizePoStatus } from '@/lib/poStatus.js';
import { APRI_STATUS, normalizeApriStatus } from '@/lib/apriStatus.js';
import { LP_STATUS, normalizeLpStatus } from '@/lib/localPurchaseStatus.js';

const STATUS_STYLES = {
  Draft: 'bg-muted text-muted-foreground',
  Approved:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/25 dark:text-emerald-300',
  Rejected: 'bg-red-100 text-red-800 dark:bg-destructive/25 dark:text-rose-300',
  'Creating in SAP': 'bg-blue-100 text-blue-800 dark:bg-blue-500/25 dark:text-blue-300',
  'Created in SAP':
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/25 dark:text-emerald-300',
  'Failed to Create in SAP':
    'bg-red-100 text-red-800 dark:bg-destructive/25 dark:text-rose-300',
  'Ready for AP Reserve Invoice':
    'bg-violet-100 text-violet-800 dark:bg-violet-500/25 dark:text-violet-300',
  Completed:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/25 dark:text-emerald-300',
  'Partially Ordered':
    'bg-sky-100 text-sky-800 dark:bg-sky-500/25 dark:text-sky-300',
  'Fully Ordered':
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/25 dark:text-emerald-300',
  Open: 'bg-blue-100 text-blue-800 dark:bg-blue-500/25 dark:text-blue-300',
  Closed: 'bg-muted text-muted-foreground',
  [PO_STATUS.DRAFT]: 'bg-muted text-muted-foreground',
  [PO_STATUS.PENDING_PM]: 'bg-amber-100 text-amber-800 dark:bg-amber-500/25 dark:text-amber-300',
  [PO_STATUS.PENDING_OM]: 'bg-amber-100 text-amber-800 dark:bg-amber-500/25 dark:text-amber-300',
  [PO_STATUS.PENDING_FINANCE]: 'bg-amber-100 text-amber-800 dark:bg-amber-500/25 dark:text-amber-300',
  [PO_STATUS.APPROVED]:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/25 dark:text-emerald-300',
  [PO_STATUS.REJECTED]: 'bg-red-100 text-red-800 dark:bg-destructive/25 dark:text-rose-300',
  [PO_STATUS.CREATING_IN_SAP]: 'bg-blue-100 text-blue-800 dark:bg-blue-500/25 dark:text-blue-300',
  [PO_STATUS.CREATED_IN_SAP]:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/25 dark:text-emerald-300',
  [PO_STATUS.FAILED_SAP]:
    'bg-red-100 text-red-800 dark:bg-destructive/25 dark:text-rose-300',
  [PO_STATUS.CANCELLED]: 'bg-muted text-muted-foreground',
  warehouse_approved:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/25 dark:text-emerald-300',
  warehouse_rejected: 'bg-red-100 text-red-800 dark:bg-destructive/25 dark:text-rose-300',
  pending_warehouse: 'bg-amber-100 text-amber-800 dark:bg-amber-500/25 dark:text-amber-300',
  creating_in_sap: 'bg-blue-100 text-blue-800 dark:bg-blue-500/25 dark:text-blue-300',
  created_in_sap:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/25 dark:text-emerald-300',
  failed_sap:
    'bg-red-100 text-red-800 dark:bg-destructive/25 dark:text-rose-300',
  [LP_STATUS.DRAFT]: 'bg-muted text-muted-foreground',
  [LP_STATUS.PENDING_PM]: 'bg-amber-100 text-amber-800 dark:bg-amber-500/25 dark:text-amber-300',
  [LP_STATUS.PENDING_FINANCE]: 'bg-amber-100 text-amber-800 dark:bg-amber-500/25 dark:text-amber-300',
  [LP_STATUS.COMPLETED]:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/25 dark:text-emerald-300',
  [LP_STATUS.REJECTED]: 'bg-red-100 text-red-800 dark:bg-destructive/25 dark:text-rose-300',
  [LP_STATUS.CANCELLED]: 'bg-muted text-muted-foreground',
};

function getStatusClass(status) {
  const normalizedPo = normalizePoStatus(status);
  const normalizedApri = normalizeApriStatus(status);
  const normalizedLp = normalizeLpStatus(status);
  if (STATUS_STYLES[normalizedPo]) {
    return STATUS_STYLES[normalizedPo];
  }
  if (STATUS_STYLES[normalizedApri]) {
    return STATUS_STYLES[normalizedApri];
  }
  if (STATUS_STYLES[normalizedLp]) {
    return STATUS_STYLES[normalizedLp];
  }
  if (STATUS_STYLES[status]) {
    return STATUS_STYLES[status];
  }
  if (status?.includes('Pending')) {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-500/25 dark:text-amber-300';
  }
  return 'bg-muted text-muted-foreground';
}

export default function AnimatedStatusBadge({ status }) {
  const { statusLabel: labelFor } = useI18n();
  const isCreating =
    normalizePoStatus(status) === PO_STATUS.CREATING_IN_SAP ||
    normalizeApriStatus(status) === APRI_STATUS.CREATING_IN_SAP;
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
