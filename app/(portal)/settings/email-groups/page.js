import PageHeader from '@/components/layout/PageHeader';
import EmailGroupsManager from '@/components/settings/EmailGroupsManager';
import { settings } from '@/lib/i18n';

export default function EmailGroupsPage() {
  return (
    <div>
      <PageHeader title={settings.emailTitle} description={settings.emailDesc} />
      <EmailGroupsManager />
    </div>
  );
}
