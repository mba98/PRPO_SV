import PageHeader from '@/components/layout/PageHeader';
import RolesManager from '@/components/settings/RolesManager';

export default function SettingsRolesPage() {
  return (
    <div>
      <PageHeader
        title="Roles"
        description="Manage roles and permission assignments. Roles in use cannot be deleted."
      />
      <RolesManager />
    </div>
  );
}
