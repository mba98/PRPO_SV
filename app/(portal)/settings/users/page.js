import PageHeader from '@/components/layout/PageHeader';
import UsersManager from '@/components/settings/UsersManager';
import { settings } from '@/lib/i18n';

export default function UsersSettingsPage() {
  return (
    <div>
      <PageHeader title={settings.usersTitle} description={settings.usersDesc} />
      <UsersManager />
    </div>
  );
}
