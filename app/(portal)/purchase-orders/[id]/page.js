import PoDetailView from '@/components/purchase-orders/PoDetailView';

export default function PurchaseOrderDetailPage({ params }) {
  return <PoDetailView id={params.id} />;
}
