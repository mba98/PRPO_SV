'use client';

import { useState } from 'react';
import { PortalLoader } from '@/components/ui';

function HealthStatusPill({ status }) {
  const isUp = status === 'up';
  const cls = isUp
    ? 'bg-green-100 text-green-800'
    : 'bg-rose-100 text-destructive';
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
    <div className="flex items-center justify-between rounded-md border border-border bg-card px-4 py-3">
      <div>
        <p className="font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">
          {dep?.latencyMs != null ? `${dep.latencyMs}ms` : '—'}
          {name === 'sap' && dep?.host && (
            <span className="ml-2 text-muted-foreground">
              {dep.host}
              {dep.companyDb ? ` · ${dep.companyDb}` : ''}
            </span>
          )}
          {dep?.error && <span className="ml-2 text-destructive">{dep.error}</span>}
        </p>
      </div>
      <HealthStatusPill status={dep?.status} />
    </div>
  );
}

export default function HealthCheckPanel() {
  const [loading, setLoading] = useState(false);
  const [sapTesting, setSapTesting] = useState(false);
  const [result, setResult] = useState(null);
  const [sapResult, setSapResult] = useState(null);
  const [error, setError] = useState(null);
  const [sapError, setSapError] = useState(null);

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

  async function runSapConnectionTest() {
    setSapTesting(true);
    setSapError(null);
    setSapResult(null);
    try {
      const res = await fetch('/api/sap/connection-test', {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();
      if (!json.success) {
        setSapError(json.message || 'SAP connection test failed');
        return;
      }
      setSapResult(json.data);
    } catch (err) {
      setSapError(err.message);
    } finally {
      setSapTesting(false);
    }
  }

  const dependencies = result?.dependencies;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-muted p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">System health</h2>
            <p className="text-sm text-muted-foreground">
              Run dependency checks (MongoDB, SAP Service Layer, HANA, S3, SMTP). Credentials are
              never shown.
            </p>
          </div>
          <button
            type="button"
            onClick={runHealthCheck}
            disabled={loading}
            className="btn-primary disabled:opacity-50"
          >
            {loading ? 'Checking…' : 'Run health check'}
          </button>
        </div>

        {error && (
          <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        {loading && <PortalLoader />}

        {dependencies && !loading && (
          <div className="space-y-2">
            {Object.entries(dependencies).map(([name, dep]) => (
              <DependencyRow key={name} name={name} dep={dep} />
            ))}
            {result?.checkedAt && (
              <p className="pt-2 text-xs text-muted-foreground">
                Checked at {new Date(result.checkedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">SAP Service Layer test</h2>
            <p className="text-sm text-muted-foreground">
              Quick login probe. Shows host and company database only — no username, password, or
              session cookies.
            </p>
          </div>
          <button
            type="button"
            data-testid="sap-connection-test-btn"
            onClick={runSapConnectionTest}
            disabled={sapTesting}
            className="rounded-md border border-brand-600 px-4 py-2 text-sm font-medium text-primary hover:bg-brand-50 disabled:opacity-50"
          >
            {sapTesting ? 'Testing…' : 'Test SAP connection'}
          </button>
        </div>

        {sapError && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{sapError}</p>
        )}

        {sapResult && (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Host</dt>
              <dd className="font-medium text-foreground">{sapResult.host || '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Company DB</dt>
              <dd className="font-medium text-foreground">{sapResult.companyDb || '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Reachable</dt>
              <dd className="font-medium text-foreground">
                {sapResult.serviceLayerReachable ? 'Yes' : 'No'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Latency</dt>
              <dd className="font-medium text-foreground">
                {sapResult.latencyMs != null ? `${sapResult.latencyMs}ms` : '—'}
              </dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}
