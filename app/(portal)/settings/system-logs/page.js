import { Suspense } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import SystemLogsManager from '@/components/settings/SystemLogsManager';
import { AnimatedSkeletonLoader } from '@/components/ui';
import { settings } from '@/lib/i18n';

export default function SystemLogsPage() {
  return (
    <div>
      <PageHeader title={settings.logsTitle} description={settings.logsDesc} />
      <Suspense fallback={<AnimatedSkeletonLoader rows={6} />}>
        <SystemLogsManager />
      </Suspense>
    </div>
  );
}
