import PageHeader from '@/components/layout/PageHeader';
import HealthCheckGate from '@/components/settings/HealthCheckGate';

export default function SapIntegrationPage() {
  return (
    <div>
      <PageHeader
        title="SAP Integration"
        description="Test connectivity to SAP Service Layer and related dependencies."
      />
      <HealthCheckGate />
    </div>
  );
}
