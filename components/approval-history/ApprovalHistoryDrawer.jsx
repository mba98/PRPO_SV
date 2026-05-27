'use client';

import { AnimatedDrawer } from '@/components/ui';
import ApprovalTimeline from '@/components/approval-history/ApprovalTimeline';

const LABELS = {
  PR: 'Purchase Request',
  PO: 'Purchase Order',
  APRI: 'A/P Reserve Invoice',
};

export default function ApprovalHistoryDrawer({
  isOpen,
  onClose,
  documentType,
  documentId,
  documentNumber,
}) {
  const title = documentNumber
    ? `${LABELS[documentType] || documentType} · ${documentNumber}`
    : 'Approval history';

  return (
    <AnimatedDrawer isOpen={isOpen} onClose={onClose} title={title} width="28rem">
      <ApprovalTimeline documentType={documentType} documentId={documentId} />
    </AnimatedDrawer>
  );
}
