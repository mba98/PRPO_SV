import { Suspense } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import SystemLogsManager from '@/components/settings/SystemLogsManager';
import { AnimatedSkeletonLoader } from '@/components/ui';

export default function SystemLogsPage() {
  return (
    <div>
      <PageHeader
        title="System Logs"
        description="Email delivery and SAP integration history. Sensitive credentials are never shown."
      />
      <Suspense fallback={<AnimatedSkeletonLoader rows={8} />}>
        <SystemLogsManager />
      </Suspense>
    </div>
  );
}
