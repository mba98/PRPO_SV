import { Suspense } from 'react';
import SectionPageHeader from '@/components/layout/SectionPageHeader';
import DashboardView from '@/components/dashboard/DashboardView';
import { PortalLoader } from '@/components/ui';

export default function DashboardPage() {
  return (
    <div>
      <SectionPageHeader section="dashboard" />
      <Suspense fallback={<PortalLoader fullScreen />}>
        <DashboardView />
      </Suspense>
    </div>
  );
}
