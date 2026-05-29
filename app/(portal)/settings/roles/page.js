import SectionPageHeader from '@/components/layout/SectionPageHeader';
import RolesManager from '@/components/settings/RolesManager';

export default function RolesSettingsPage() {
  return (
    <div>
      <SectionPageHeader section="settings" titleKey="rolesTitle" descriptionKey="rolesDesc" />
      <RolesManager />
    </div>
  );
}
