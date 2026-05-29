import { Suspense } from 'react';
import SectionPageHeader from '@/components/layout/SectionPageHeader';
import ApriListManager from '@/components/ap-reserve-invoices/ApriListManager';
import { AnimatedSkeletonLoader } from '@/components/ui';

export default function ApReserveInvoicesPage() {
  return (
    <div>
      <SectionPageHeader section="apri" />
      <Suspense fallback={<AnimatedSkeletonLoader rows={6} />}>
        <ApriListManager />
      </Suspense>
    </div>
  );
}
