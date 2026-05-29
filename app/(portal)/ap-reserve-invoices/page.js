import { Suspense } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import ApriListManager from '@/components/ap-reserve-invoices/ApriListManager';
import { AnimatedSkeletonLoader } from '@/components/ui';
import { apri } from '@/lib/i18n';

export default function ApReserveInvoicesPage() {
  return (
    <div>
      <PageHeader title={apri.title} description={apri.description} />
      <Suspense fallback={<AnimatedSkeletonLoader rows={6} />}>
        <ApriListManager />
      </Suspense>
    </div>
  );
}
