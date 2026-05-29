import { Suspense } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import DashboardView from '@/components/dashboard/DashboardView';
import { AnimatedSkeletonLoader } from '@/components/ui';
import { dashboard } from '@/lib/i18n';

export default function DashboardPage() {
  return (
    <div>
      <PageHeader title={dashboard.title} description={dashboard.description} />
      <Suspense fallback={<AnimatedSkeletonLoader rows={8} />}>
        <DashboardView />
      </Suspense>
    </div>
  );
}
