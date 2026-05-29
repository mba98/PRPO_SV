'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { AnimatedSkeletonLoader, AnimatedStatusBadge } from '@/components/ui';
import AttachmentPanel from '@/components/attachments/AttachmentPanel';
import CommentsPanel from '@/components/comments/CommentsPanel';
import ApprovalTimeline from '@/components/approval-history/ApprovalTimeline';

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

  const tabs = ['details', 'attachments', 'comments', 'history', 'emails'];

  const canUploadAttachments =
    hasPermission('apinvoice.create') || hasPermission('view.all');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/ap-reserve-invoices" className="text-primary hover:underline">
              A/P Reserve Invoices
            </Link>
            {' / '}
            {apri.portalAPNumber}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">{apri.portalAPNumber}</h1>
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

      <div className="flex gap-2 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize ${
              activeTab === t
                ? 'border-b-2 border-brand-600 text-primary'
                : 'text-muted-foreground hover:text-foreground'
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
                <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
                <p className="mt-1 text-sm">{val ?? '—'}</p>
              </div>
            ))}
            {apri.relatedPO?.id && (
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">PO link</p>
                <Link
                  href={`/purchase-orders/${apri.relatedPO.id}`}
                  className="mt-1 text-sm text-primary hover:underline"
                >
                  View purchase order
                </Link>
              </div>
            )}
            {apri.sapErrorMessage && (
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase text-destructive">SAP error</p>
                <p className="mt-1 text-sm text-destructive">{apri.sapErrorMessage}</p>
              </div>
            )}
          </section>

          {apri.sapResponse && (
            <section className="card">
              <h2 className="mb-2 text-lg font-semibold">SAP response</h2>
              <pre className="max-h-64 overflow-auto rounded bg-muted p-3 text-xs text-foreground">
                {JSON.stringify(apri.sapResponse, null, 2)}
              </pre>
            </section>
          )}

          <section className="card overflow-x-auto">
            <h2 className="mb-4 text-lg font-semibold">Line items</h2>
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
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
                      <span className="ml-2 text-muted-foreground">{line.itemName}</span>
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

      {activeTab === 'attachments' && (
        <AttachmentPanel
          documentType="APRI"
          documentId={id}
          canUpload={canUploadAttachments}
        />
      )}

      {activeTab === 'comments' && (
        <CommentsPanel documentType="APRI" documentId={id} />
      )}

      {activeTab === 'history' && (
        <ApprovalTimeline documentType="APRI" documentId={id} />
      )}

      {activeTab === 'emails' && (
        <section className="card overflow-x-auto">
          {(apri.emailLogs || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No email logs</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
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
