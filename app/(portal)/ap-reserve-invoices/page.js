import { Suspense } from 'react';
import SectionPageHeader from '@/components/layout/SectionPageHeader';
import ApriListManager from '@/components/ap-reserve-invoices/ApriListManager';
import { PortalLoader } from '@/components/ui';

export default function ApReserveInvoicesPage() {
  return (
    <div>
      <SectionPageHeader section="apri" />
      <Suspense fallback={<PortalLoader fullScreen />}>
        <ApriListManager />
      </Suspense>
    </div>
  );
}
