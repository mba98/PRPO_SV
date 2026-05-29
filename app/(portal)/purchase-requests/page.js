import { Suspense } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import PrListManager from '@/components/purchase-requests/PrListManager';
import { AnimatedSkeletonLoader } from '@/components/ui';
import { pr } from '@/lib/i18n';

export default function PurchaseRequestsPage() {
  return (
    <div>
      <PageHeader title={pr.title} description={pr.description} />
      <Suspense fallback={<AnimatedSkeletonLoader rows={6} />}>
        <PrListManager />
      </Suspense>
    </div>
  );
}
