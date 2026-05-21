import PrDetailView from '@/components/purchase-requests/PrDetailView';

export default function PurchaseRequestDetailPage({ params }) {
  return <PrDetailView id={params.id} />;
}
