import { Suspense } from 'react';
import SectionPageHeader from '@/components/layout/SectionPageHeader';
import PoListManager from '@/components/purchase-orders/PoListManager';
import { AnimatedSkeletonLoader } from '@/components/ui';

export default function PurchaseOrdersPage() {
  return (
    <div>
      <SectionPageHeader section="po" />
      <Suspense fallback={<AnimatedSkeletonLoader rows={6} />}>
        <PoListManager />
      </Suspense>
    </div>
  );
}
