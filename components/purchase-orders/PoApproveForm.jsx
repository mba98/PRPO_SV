'use client';

import DocumentApproveForm from '@/components/approval/DocumentApproveForm';

export default function PoApproveForm({ id }) {
  return <DocumentApproveForm id={id} kind="PO" />;
}
