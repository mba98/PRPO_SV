import { Suspense } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import ApprovedForPoManager from '@/components/purchase-requests/ApprovedForPoManager';
import { AnimatedSkeletonLoader } from '@/components/ui';

export default function ApprovedForPoPage() {
  return (
    <div>
      <PageHeader
        title="PRs ready for PO"
        description="Select an SAP-approved purchase request, choose a vendor, and create a purchase order in SAP Business One."
      />
      <Suspense fallback={<AnimatedSkeletonLoader rows={5} />}>
        <ApprovedForPoManager />
      </Suspense>
    </div>
  );
}
