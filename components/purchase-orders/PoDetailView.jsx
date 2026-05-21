'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { AnimatedSkeletonLoader, AnimatedStatusBadge } from '@/components/ui';

export default function PoDetailView({ id }) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('details');

  const load = useCallback(async () => {
    setLoading(true);
    const { json } = await apiFetch(`/api/purchase-orders/${id}`);
    if (json.success) setPo(json.data);
    else setError(json.message || 'Failed to load');
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function retrySap() {
    const { json } = await apiFetch(`/api/purchase-orders/${id}/retry-sap`, { method: 'POST' });
    if (json.success) load();
    else setError(json.message || 'Retry failed');
  }

  if (loading) return <AnimatedSkeletonLoader rows={8} />;
  if (!po) return <p className="text-red-600">{error || 'Not found'}</p>;

  const canApprove =
    ['Pending Project Manager Approval', 'Pending Finance Approval'].includes(po.status) &&
    (hasPermission('po.approve.pm') ||
      hasPermission('po.approve.finance') ||
      hasPermission('view.all'));

  const tabs = ['details', 'attachments', 'history'];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            <Link href="/purchase-orders" className="text-brand-600 hover:underline">
              Purchase Orders
            </Link>
            {' / '}
            {po.portalPONumber}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">{po.portalPONumber}</h1>
          <div className="mt-2">
            <AnimatedStatusBadge status={po.status} />
          </div>
        </div>
        <div className="flex gap-2">
          {canApprove && (
            <Link href={`/purchase-orders/${id}/approve`} className="btn-primary">
              Approve / Reject
            </Link>
          )}
          {po.status === 'Failed to Create in SAP' &&
            (hasPermission('view.all') || hasPermission('admin.settings')) && (
              <button type="button" className="btn-secondary" onClick={retrySap}>
                Retry SAP
              </button>
            )}
        </div>
      </div>

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
              ['Vendor', po.vendor],
              ['Department', po.department],
              ['Related PR', po.relatedPRNumber],
              ['SAP PR', po.relatedSAPPRDocNum],
              ['SAP PO', po.sapPODocNum],
            ].map(([label, val]) => (
              <div key={label}>
                <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
                <p className="mt-1 text-sm">{val || '—'}</p>
              </div>
            ))}
            {po.relatedPRId && (
              <div>
                <p className="text-xs font-medium uppercase text-slate-500">PR link</p>
                <Link
                  href={`/purchase-requests/${po.relatedPRId}`}
                  className="mt-1 text-sm text-brand-600 hover:underline"
                >
                  View purchase request
                </Link>
              </div>
            )}
            {po.sapErrorMessage && (
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase text-rose-600">SAP error</p>
                <p className="mt-1 text-sm text-rose-700">{po.sapErrorMessage}</p>
              </div>
            )}
          </section>
          <section className="card overflow-x-auto">
            <h2 className="mb-4 text-lg font-semibold">Line items</h2>
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="pb-2 pr-4">Item</th>
                  <th className="pb-2 pr-4">Qty</th>
                  <th className="pb-2 pr-4">Unit price</th>
                  <th className="pb-2">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(po.lines || []).map((line, i) => (
                  <tr key={line._id || i}>
                    <td className="py-2 pr-4">
                      <span className="font-medium">{line.itemCode}</span>
                      <span className="ml-2 text-slate-600">{line.itemName}</span>
                    </td>
                    <td className="py-2 pr-4">{line.quantity}</td>
                    <td className="py-2 pr-4">{line.unitPrice ?? '—'}</td>
                    <td className="py-2">{line.lineTotal ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      {activeTab === 'attachments' && (
        <section className="card">
          {(po.attachments || []).length === 0 ? (
            <p className="text-sm text-slate-500">No files attached</p>
          ) : (
            <ul className="space-y-2">
              {po.attachments.map((a) => (
                <li key={a.id}>
                  <a
                    href={a.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-brand-600 hover:underline"
                  >
                    {a.fileName}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {activeTab === 'history' && (
        <section className="card">
          <ol className="relative border-l border-slate-200 pl-6">
            {(po.approvalHistory || []).map((h) => (
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
        </section>
      )}
    </div>
  );
}
