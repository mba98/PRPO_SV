import { Suspense } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import PoListManager from '@/components/purchase-orders/PoListManager';
import { AnimatedSkeletonLoader } from '@/components/ui';

export default function PurchaseOrdersPage() {
  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        description="Review and approve purchase orders. SAP documents are created after final finance approval."
      />
      <Suspense fallback={<AnimatedSkeletonLoader rows={6} />}>
        <PoListManager />
      </Suspense>
    </div>
  );
}
