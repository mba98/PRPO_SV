import PrApproveForm from '@/components/purchase-requests/PrApproveForm';

export default function PurchaseRequestApprovePage({ params }) {
  return <PrApproveForm id={params.id} />;
}
