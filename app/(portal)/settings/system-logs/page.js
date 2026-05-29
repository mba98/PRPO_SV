import { Suspense } from 'react';
import SectionPageHeader from '@/components/layout/SectionPageHeader';
import SystemLogsManager from '@/components/settings/SystemLogsManager';
import { AnimatedSkeletonLoader } from '@/components/ui';

export default function SystemLogsPage() {
  return (
    <div>
      <SectionPageHeader section="settings" titleKey="logsTitle" descriptionKey="logsDesc" />
      <Suspense fallback={<AnimatedSkeletonLoader rows={6} />}>
        <SystemLogsManager />
      </Suspense>
    </div>
  );
}
