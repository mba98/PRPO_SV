import PageHeader from '@/components/layout/PageHeader';
import HealthCheckGate from '@/components/settings/HealthCheckGate';

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Procurement workflow overview. Module metrics arrive in Phase 10."
      />
      <div className="grid gap-6">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-slate-600">
            Welcome to the Procurement Portal. Purchase request, order, and invoice workflows
            will be enabled in upcoming phases.
          </p>
        </div>
        <HealthCheckGate />
      </div>
    </div>
  );
}
