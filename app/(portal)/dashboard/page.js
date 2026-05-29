import { Suspense } from 'react';
import SectionPageHeader from '@/components/layout/SectionPageHeader';
import DashboardView from '@/components/dashboard/DashboardView';
import { AnimatedSkeletonLoader } from '@/components/ui';

export default function DashboardPage() {
  return (
    <div>
      <SectionPageHeader section="dashboard" />
      <Suspense fallback={<AnimatedSkeletonLoader rows={8} />}>
        <DashboardView />
      </Suspense>
    </div>
  );
}
