import { Suspense } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import PrCreateForm from '@/components/purchase-requests/PrCreateForm';
import { AnimatedSkeletonLoader } from '@/components/ui';
import { pr } from '@/lib/i18n';

export default function CreatePurchaseRequestPage() {
  return (
    <div>
      <PageHeader title={pr.createTitle} description={pr.createDesc} />
      <Suspense fallback={<AnimatedSkeletonLoader rows={10} />}>
        <PrCreateForm />
      </Suspense>
    </div>
  );
}
