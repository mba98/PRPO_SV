'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { AnimatedSkeletonLoader, AnimatedStatusBadge } from '@/components/ui';
import WorkflowStepper from '@/components/workflow/WorkflowStepper';
import PoEditForm from '@/components/purchase-orders/PoEditForm';
import AttachmentPanel from '@/components/attachments/AttachmentPanel';
import CommentsPanel from '@/components/comments/CommentsPanel';
import ApprovalTimeline from '@/components/approval-history/ApprovalTimeline';

export default function PoDetailView({ id }) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const [editing, setEditing] = useState(false);

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

  const tabs = ['details', 'attachments', 'comments', 'history'];

  return (
    <div className="space-y-6">
      {po.workflowSteps?.length > 0 && <WorkflowStepper steps={po.workflowSteps} />}

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
          {po.canEdit && !editing && (
            <button type="button" className="btn-secondary" onClick={() => setEditing(true)}>
              Edit
            </button>
          )}
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

      {activeTab === 'details' && editing && po.canEdit && (
        <PoEditForm
          po={po}
          onSaved={() => {
            setEditing(false);
            load();
          }}
          onCancel={() => setEditing(false)}
        />
      )}

      {activeTab === 'details' && !editing && (
        <>
          <section className="card grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Vendor', po.vendor],
              ['Department', po.department],
              ['Exchange rate', po.docRate != null ? po.docRate : null],
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
            {po.sapWarnings && (
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase text-amber-600">SAP warnings</p>
                <p className="mt-1 text-sm text-amber-800">{po.sapWarnings}</p>
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
                  <th className="pb-2 pr-4">UoM code</th>
                  <th className="pb-2 pr-4">Warehouse</th>
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
                    <td className="py-2 pr-4">{line.uomCode || line.uom || '—'}</td>
                    <td className="py-2 pr-4">{line.warehouseCode || '—'}</td>
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
          documentType="PO"
          documentId={id}
          canUpload={
            hasPermission('po.create') ||
            hasPermission('po.approve.pm') ||
            hasPermission('po.approve.finance') ||
            hasPermission('view.all')
          }
          approvalStep={po.currentApprovalStep}
        />
      )}

      {activeTab === 'comments' && (
        <CommentsPanel documentType="PO" documentId={id} />
      )}

      {activeTab === 'history' && (
        <ApprovalTimeline documentType="PO" documentId={id} />
      )}
    </div>
  );
}
