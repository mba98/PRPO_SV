import { Suspense } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import ApriListManager from '@/components/ap-reserve-invoices/ApriListManager';
import { AnimatedSkeletonLoader } from '@/components/ui';

export default function ApReserveInvoicesPage() {
  return (
    <div>
      <PageHeader
        title="A/P Reserve Invoices"
        description="Reserve invoices created from SAP purchase orders."
      />
      <Suspense fallback={<AnimatedSkeletonLoader rows={6} />}>
        <ApriListManager />
      </Suspense>
    </div>
  );
}
