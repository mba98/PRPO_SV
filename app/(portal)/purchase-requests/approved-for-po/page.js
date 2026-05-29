import { Suspense } from 'react';
import SectionPageHeader from '@/components/layout/SectionPageHeader';
import ApprovedForPoManager from '@/components/purchase-requests/ApprovedForPoManager';
import { AnimatedSkeletonLoader } from '@/components/ui';

export default function ApprovedForPoPage() {
  return (
    <div>
      <SectionPageHeader
        section="pr"
        titleKey="approvedForPoTitle"
        descriptionKey="approvedForPoDesc"
      />
      <Suspense fallback={<AnimatedSkeletonLoader rows={6} />}>
        <ApprovedForPoManager />
      </Suspense>
    </div>
  );
}
