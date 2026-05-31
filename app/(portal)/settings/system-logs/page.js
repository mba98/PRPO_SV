import { Suspense } from 'react';
import SectionPageHeader from '@/components/layout/SectionPageHeader';
import SystemLogsManager from '@/components/settings/SystemLogsManager';
import { PortalLoader } from '@/components/ui';

export default function SystemLogsPage() {
  return (
    <div>
      <SectionPageHeader section="settings" titleKey="logsTitle" descriptionKey="logsDesc" />
      <Suspense fallback={<PortalLoader fullScreen />}>
        <SystemLogsManager />
      </Suspense>
    </div>
  );
}
