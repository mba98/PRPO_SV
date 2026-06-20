import SectionPageHeader from '@/components/layout/SectionPageHeader';
import LpForm from '@/components/local-purchases/LpForm';

export default function LocalPurchaseCreatePage() {
  return (
    <div>
      <SectionPageHeader section="lp" titleKey="createTitle" descriptionKey="createDescription" />
      <LpForm mode="create" />
    </div>
  );
}
