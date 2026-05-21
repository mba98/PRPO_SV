'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { AnimatedSkeletonLoader, AnimatedStatusBadge } from '@/components/ui';

export default function ApriDetailView({ id }) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [apri, setApri] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { json } = await apiFetch(`/api/ap-reserve-invoices/${id}`);
    if (json.success) setApri(json.data);
    else setError(json.message || 'Failed to load');
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function retrySap() {
    setRetrying(true);
    setError('');
    const { json } = await apiFetch(`/api/ap-reserve-invoices/${id}/retry-sap`, { method: 'POST' });
    setRetrying(false);
    if (json.success) load();
    else setError(json.message || 'Retry failed');
  }

  if (loading) return <AnimatedSkeletonLoader rows={8} />;
  if (!apri) return <p className="text-red-600">{error || 'Not found'}</p>;

  const canRetry =
    apri.status === 'Failed to Create in SAP' &&
    (hasPermission('view.all') || hasPermission('admin.settings'));

  const tabs = ['details', 'history', 'emails'];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            <Link href="/ap-reserve-invoices" className="text-brand-600 hover:underline">
              A/P Reserve Invoices
            </Link>
            {' / '}
            {apri.portalAPNumber}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">{apri.portalAPNumber}</h1>
          <div className="mt-2">
            <AnimatedStatusBadge status={apri.status} />
          </div>
        </div>
        {canRetry && (
          <button type="button" className="btn-secondary" onClick={retrySap} disabled={retrying}>
            {retrying ? 'Retrying…' : 'Retry SAP'}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize ${
              activeTab === t
                ? 'border-b-2 border-brand-600 text-brand-700'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {activeTab === 'details' && (
        <>
          <section className="card grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Vendor', apri.vendor],
              ['Related PO', apri.relatedPONumber],
              ['SAP PO DocEntry', apri.relatedSAPPODocEntry],
              ['SAP PO DocNum', apri.relatedSAPPODocNum],
              ['SAP AP DocNum', apri.sapAPDocNum],
              ['SAP AP DocEntry', apri.sapAPDocEntry],
            ].map(([label, val]) => (
              <div key={label}>
                <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
                <p className="mt-1 text-sm">{val ?? '—'}</p>
              </div>
            ))}
            {apri.relatedPO?.id && (
              <div>
                <p className="text-xs font-medium uppercase text-slate-500">PO link</p>
                <Link
                  href={`/purchase-orders/${apri.relatedPO.id}`}
                  className="mt-1 text-sm text-brand-600 hover:underline"
                >
                  View purchase order
                </Link>
              </div>
            )}
            {apri.sapErrorMessage && (
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase text-rose-600">SAP error</p>
                <p className="mt-1 text-sm text-rose-700">{apri.sapErrorMessage}</p>
              </div>
            )}
          </section>

          {apri.sapResponse && (
            <section className="card">
              <h2 className="mb-2 text-lg font-semibold">SAP response</h2>
              <pre className="max-h-64 overflow-auto rounded bg-slate-50 p-3 text-xs text-slate-700">
                {JSON.stringify(apri.sapResponse, null, 2)}
              </pre>
            </section>
          )}

          <section className="card overflow-x-auto">
            <h2 className="mb-4 text-lg font-semibold">Line items</h2>
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="pb-2 pr-4">Item</th>
                  <th className="pb-2 pr-4">PO line</th>
                  <th className="pb-2 pr-4">Qty</th>
                  <th className="pb-2">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(apri.lines || []).map((line, i) => (
                  <tr key={line._id || i}>
                    <td className="py-2 pr-4">
                      <span className="font-medium">{line.itemCode}</span>
                      <span className="ml-2 text-slate-600">{line.itemName}</span>
                    </td>
                    <td className="py-2 pr-4">{line.relatedPOLineNum ?? '—'}</td>
                    <td className="py-2 pr-4">{line.quantity}</td>
                    <td className="py-2">{line.lineTotal ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      {activeTab === 'history' && (
        <section className="card">
          {(apri.approvalHistory || []).length === 0 ? (
            <p className="text-sm text-slate-500">No history recorded</p>
          ) : (
            <ol className="relative border-l border-slate-200 pl-6">
              {apri.approvalHistory.map((h) => (
                <li key={h.id} className="mb-6 ml-2">
                  <span className="absolute -left-[9px] mt-1.5 h-4 w-4 rounded-full border-2 border-white bg-brand-500" />
                  <p className="text-sm font-medium">
                    {h.action} — {h.stepName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {h.actionBy} · {new Date(h.actionDate).toLocaleString()}
                  </p>
                  {h.comment && <p className="mt-1 text-sm text-slate-600">{h.comment}</p>}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {activeTab === 'emails' && (
        <section className="card overflow-x-auto">
          {(apri.emailLogs || []).length === 0 ? (
            <p className="text-sm text-slate-500">No email logs</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="pb-2 pr-4">To</th>
                  <th className="pb-2 pr-4">Subject</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Sent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {apri.emailLogs.map((e) => (
                  <tr key={e.id}>
                    <td className="py-2 pr-4">{e.to}</td>
                    <td className="py-2 pr-4">{e.subject}</td>
                    <td className="py-2 pr-4">{e.emailStatus}</td>
                    <td className="py-2">
                      {e.sentAt ? new Date(e.sentAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}
