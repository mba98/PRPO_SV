import SectionPageHeader from '@/components/layout/SectionPageHeader';
import UsersManager from '@/components/settings/UsersManager';

export default function UsersSettingsPage() {
  return (
    <div>
      <SectionPageHeader section="settings" titleKey="usersTitle" descriptionKey="usersDesc" />
      <UsersManager />
    </div>
  );
}
