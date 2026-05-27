import PageHeader from '@/components/layout/PageHeader';
import EmailLogsManager from '@/components/settings/EmailLogsManager';

export default function SystemLogsPage() {
  return (
    <div>
      <PageHeader
        title="Email Logs"
        description="Delivery history for workflow notification emails."
      />
      <EmailLogsManager />
    </div>
  );
}
