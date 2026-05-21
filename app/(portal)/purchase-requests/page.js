import { Suspense } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import PrListManager from '@/components/purchase-requests/PrListManager';
import { AnimatedSkeletonLoader } from '@/components/ui';

export default function PurchaseRequestsPage() {
  return (
    <div>
      <PageHeader
        title="Purchase Requests"
        description="Create, track, and approve purchase requests through warehouse and project manager approval."
      />
      <Suspense fallback={<AnimatedSkeletonLoader rows={6} />}>
        <PrListManager />
      </Suspense>
    </div>
  );
}
