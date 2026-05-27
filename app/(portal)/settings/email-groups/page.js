import PageHeader from '@/components/layout/PageHeader';
import EmailGroupsManager from '@/components/settings/EmailGroupsManager';

export default function EmailGroupsPage() {
  return (
    <div>
      <PageHeader
        title="Email Groups"
        description="Configure notification recipients for each workflow event."
      />
      <EmailGroupsManager />
    </div>
  );
}
