import { Suspense } from 'react';
import SectionPageHeader from '@/components/layout/SectionPageHeader';
import PoListManager from '@/components/purchase-orders/PoListManager';
import { PortalLoader } from '@/components/ui';

export default function PurchaseOrdersPage() {
  return (
    <div>
      <SectionPageHeader section="po" />
      <Suspense fallback={<PortalLoader fullScreen />}>
        <PoListManager />
      </Suspense>
    </div>
  );
}
