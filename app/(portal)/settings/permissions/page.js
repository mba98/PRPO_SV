import SectionPageHeader from '@/components/layout/SectionPageHeader';
import PermissionsManager from '@/components/settings/PermissionsManager';

export default function PermissionsSettingsPage() {
  return (
    <div>
      <SectionPageHeader section="settings" titleKey="permissionsTitle" descriptionKey="permissionsDesc" />
      <PermissionsManager />
    </div>
  );
}
