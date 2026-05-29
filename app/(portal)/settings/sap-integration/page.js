import SectionPageHeader from '@/components/layout/SectionPageHeader';
import HealthCheckGate from '@/components/settings/HealthCheckGate';

export default function SapIntegrationPage() {
  return (
    <div>
      <SectionPageHeader section="settings" titleKey="sapTitle" descriptionKey="sapDesc" />
      <HealthCheckGate />
    </div>
  );
}
