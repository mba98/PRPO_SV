import PageHeader from '@/components/layout/PageHeader';
import HealthCheckGate from '@/components/settings/HealthCheckGate';
import { settings } from '@/lib/i18n';

export default function SapIntegrationPage() {
  return (
    <div>
      <PageHeader title={settings.sapTitle} description={settings.sapDesc} />
      <HealthCheckGate />
    </div>
  );
}
