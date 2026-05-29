import PageHeader from '@/components/layout/PageHeader';
import RolesManager from '@/components/settings/RolesManager';
import { settings } from '@/lib/i18n';

export default function RolesSettingsPage() {
  return (
    <div>
      <PageHeader title={settings.rolesTitle} description={settings.rolesDesc} />
      <RolesManager />
    </div>
  );
}
