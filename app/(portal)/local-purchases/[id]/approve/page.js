import DocumentApproveForm from '@/components/approval/DocumentApproveForm';

export default function LocalPurchaseApprovePage({ params }) {
  return <DocumentApproveForm id={params.id} kind="LOCAL_PURCHASE" />;
}
