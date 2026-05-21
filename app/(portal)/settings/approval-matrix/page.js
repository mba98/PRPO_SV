import PageHeader from '@/components/layout/PageHeader';
import ApprovalMatrixManager from '@/components/settings/ApprovalMatrixManager';

export default function SettingsApprovalMatrixPage() {
  return (
    <div>
      <PageHeader
        title="Approval Matrix"
        description="Configure PR and PO approval steps. Workflow logic reads from this collection only."
      />
      <ApprovalMatrixManager />
    </div>
  );
}
