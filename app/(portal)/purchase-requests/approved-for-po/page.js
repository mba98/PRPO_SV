import { Suspense } from 'react';
import SectionPageHeader from '@/components/layout/SectionPageHeader';
import ApprovedForPoManager from '@/components/purchase-requests/ApprovedForPoManager';
import { PortalLoader } from '@/components/ui';

export default function ApprovedForPoPage() {
  return (
    <div>
      <SectionPageHeader
        section="pr"
        titleKey="approvedForPoTitle"
        descriptionKey="approvedForPoDesc"
      />
      <Suspense fallback={<PortalLoader fullScreen />}>
        <ApprovedForPoManager />
      </Suspense>
    </div>
  );
}
