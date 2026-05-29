import { Suspense } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import PoListManager from '@/components/purchase-orders/PoListManager';
import { AnimatedSkeletonLoader } from '@/components/ui';
import { po } from '@/lib/i18n';

export default function PurchaseOrdersPage() {
  return (
    <div>
      <PageHeader title={po.title} description={po.description} />
      <Suspense fallback={<AnimatedSkeletonLoader rows={6} />}>
        <PoListManager />
      </Suspense>
    </div>
  );
}
