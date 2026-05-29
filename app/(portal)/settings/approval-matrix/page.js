import SectionPageHeader from '@/components/layout/SectionPageHeader';
import ApprovalMatrixManager from '@/components/settings/ApprovalMatrixManager';

export default function ApprovalMatrixPage() {
  return (
    <div>
      <SectionPageHeader section="settings" titleKey="matrixTitle" descriptionKey="matrixDesc" />
      <ApprovalMatrixManager />
    </div>
  );
}
