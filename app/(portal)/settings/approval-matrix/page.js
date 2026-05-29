import PageHeader from '@/components/layout/PageHeader';
import ApprovalMatrixManager from '@/components/settings/ApprovalMatrixManager';
import { settings } from '@/lib/i18n';

export default function ApprovalMatrixPage() {
  return (
    <div>
      <PageHeader title={settings.matrixTitle} description={settings.matrixDesc} />
      <ApprovalMatrixManager />
    </div>
  );
}
