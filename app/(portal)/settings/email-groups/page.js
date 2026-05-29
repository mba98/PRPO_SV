import SectionPageHeader from '@/components/layout/SectionPageHeader';
import EmailGroupsManager from '@/components/settings/EmailGroupsManager';

export default function EmailGroupsPage() {
  return (
    <div>
      <SectionPageHeader section="settings" titleKey="emailTitle" descriptionKey="emailDesc" />
      <EmailGroupsManager />
    </div>
  );
}
