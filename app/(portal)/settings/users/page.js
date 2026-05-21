import PageHeader from '@/components/layout/PageHeader';
import UsersManager from '@/components/settings/UsersManager';

export default function SettingsUsersPage() {
  return (
    <div>
      <PageHeader
        title="Users"
        description="Create, edit, and deactivate portal users. Assign roles and manage access."
      />
      <UsersManager />
    </div>
  );
}
