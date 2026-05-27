import { Suspense } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import DashboardView from '@/components/dashboard/DashboardView';
import { AnimatedSkeletonLoader } from '@/components/ui';

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Procurement workflow overview — purchase requests, orders, invoices, and integration health."
      />
      <Suspense fallback={<AnimatedSkeletonLoader rows={8} />}>
        <DashboardView />
      </Suspense>
    </div>
  );
}
