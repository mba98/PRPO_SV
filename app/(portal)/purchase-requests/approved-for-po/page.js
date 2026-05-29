import { Suspense } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import ApprovedForPoManager from '@/components/purchase-requests/ApprovedForPoManager';
import { AnimatedSkeletonLoader } from '@/components/ui';
import { pr } from '@/lib/i18n';

export default function ApprovedForPoPage() {
  return (
    <div>
      <PageHeader title={pr.approvedForPoTitle} description={pr.approvedForPoDesc} />
      <Suspense fallback={<AnimatedSkeletonLoader rows={6} />}>
        <ApprovedForPoManager />
      </Suspense>
    </div>
  );
}
