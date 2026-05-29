import { Suspense } from 'react';
import SectionPageHeader from '@/components/layout/SectionPageHeader';
import PrCreateForm from '@/components/purchase-requests/PrCreateForm';
import { AnimatedSkeletonLoader } from '@/components/ui';

export default function CreatePurchaseRequestPage() {
  return (
    <div>
      <SectionPageHeader section="pr" titleKey="createTitle" descriptionKey="createDesc" />
      <Suspense fallback={<AnimatedSkeletonLoader rows={10} />}>
        <PrCreateForm />
      </Suspense>
    </div>
  );
}
