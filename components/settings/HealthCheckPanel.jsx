'use client';

import { useState } from 'react';
import { AnimatedSkeletonLoader } from '@/components/ui';

function HealthStatusPill({ status }) {
  const isUp = status === 'up';
  const cls = isUp
    ? 'bg-green-100 text-green-800'
    : 'bg-rose-100 text-rose-800';
  const label = isUp ? 'Healthy' : 'Failed';
  return (
    <span
      data-testid="health-status-pill"
      data-status={status}
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${cls}`}
    >
      {label}
    </span>
  );
}

function DependencyRow({ name, dep }) {
  const label = name.toUpperCase();

  return (
    <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-4 py-3">
      <div>
        <p className="font-medium text-slate-900">{label}</p>
        <p className="text-xs text-slate-500">
          {dep?.latencyMs != null ? `${dep.latencyMs}ms` : '—'}
          {dep?.error && <span className="ml-2 text-rose-600">{dep.error}</span>}
        </p>
      </div>
      <HealthStatusPill status={dep?.status} />
    </div>
  );
}

export default function HealthCheckPanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function runHealthCheck() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/health', { credentials: 'include' });
      const json = await res.json();
      if (!json.success) {
        setError(json.message || 'Health check failed');
        if (json.data?.dependencies) {
          setResult(json.data);
        }
        return;
      }
      setResult(json.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const dependencies = result?.dependencies;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">System health</h2>
          <p className="text-sm text-slate-600">
            Run dependency checks (MongoDB, SAP SL, HANA, S3, SMTP). Admin only.
          </p>
        </div>
        <button
          type="button"
          onClick={runHealthCheck}
          disabled={loading}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? 'Checking…' : 'Run health check'}
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}

      {loading && <AnimatedSkeletonLoader variant="timeline" steps={5} />}

      {dependencies && !loading && (
        <div className="space-y-2">
          {Object.entries(dependencies).map(([name, dep]) => (
            <DependencyRow key={name} name={name} dep={dep} />
          ))}
          {result?.checkedAt && (
            <p className="pt-2 text-xs text-slate-500">
              Checked at {new Date(result.checkedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
