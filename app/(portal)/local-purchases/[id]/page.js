import LpDetailView from '@/components/local-purchases/LpDetailView';

export default function LocalPurchaseDetailPage({ params }) {
  return <LpDetailView id={params.id} />;
}
