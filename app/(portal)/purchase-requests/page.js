import { Suspense } from 'react';
import SectionPageHeader from '@/components/layout/SectionPageHeader';
import PrListManager from '@/components/purchase-requests/PrListManager';
import { PortalLoader } from '@/components/ui';

export default function PurchaseRequestsPage() {
  return (
    <div>
      <SectionPageHeader section="pr" />
      <Suspense fallback={<PortalLoader fullScreen />}>
        <PrListManager />
      </Suspense>
    </div>
  );
}
