import PoApproveForm from '@/components/purchase-orders/PoApproveForm';

export default function PurchaseOrderApprovePage({ params }) {
  return <PoApproveForm id={params.id} />;
}
