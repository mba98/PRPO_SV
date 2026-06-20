import { Suspense } from 'react';
import SectionPageHeader from '@/components/layout/SectionPageHeader';
import LpListManager from '@/components/local-purchases/LpListManager';
import { PortalLoader } from '@/components/ui';

export default function LocalPurchasesPage() {
  return (
    <div>
      <SectionPageHeader section="lp" />
      <Suspense fallback={<PortalLoader fullScreen />}>
        <LpListManager />
      </Suspense>
    </div>
  );
}
