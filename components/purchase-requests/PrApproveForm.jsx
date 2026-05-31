'use client';

import DocumentApproveForm from '@/components/approval/DocumentApproveForm';

export default function PrApproveForm({ id }) {
  return <DocumentApproveForm id={id} kind="PR" />;
}
