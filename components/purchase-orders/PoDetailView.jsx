'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { PortalLoader, AnimatedStatusBadge, AnimatedTabs, Button } from '@/components/ui';
import { useI18n } from '@/lib/hooks/useI18n';
import { usePortalDocument } from '@/lib/hooks/usePortalDocument';
import { primePortalDocument } from '@/lib/documentClientCache';
import { WorkflowStepper } from '@/components/workflow';
import PoEditForm from '@/components/purchase-orders/PoEditForm';
import AttachmentPanel from '@/components/attachments/AttachmentPanel';
import CommentsPanel from '@/components/comments/CommentsPanel';
import ApprovalTimeline from '@/components/approval-history/ApprovalTimeline';
import { isPendingPoApprovalStatus } from '@/lib/poStatus.js';
import { PO_VIEW_PERMISSIONS } from '@/lib/poPermissions.js';

export default function PoDetailView({ id }) {
  const { common, detail, po: poI18n } = useI18n();
  const searchParams = useSearchParams();
  const attachmentWarning = searchParams.get('attachmentWarning');
  const hasAnyPermission = useAuthStore((s) => s.hasAnyPermission);
  const { doc: po, loading, error, refresh, setDocument } = usePortalDocument('PO', id, 'PoDetailView');
  const userId = useAuthStore((s) => s.user?.id);
  const [retryingSap, setRetryingSap] = useState(false);
  const [actionError, setActionError] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (attachmentWarning) setActiveTab('attachments');
  }, [attachmentWarning]);

  async function retrySap() {
    if (retryingSap) return;
    setRetryingSap(true);
    setActionError('');
    try {
      const { json } = await apiFetch(`/api/purchase-orders/${id}/retry-sap`, {
        method: 'POST',
        dedupe: false,
      });
      if (json.success) {
        if (json.data) setDocument(json.data);
        else await refresh();
      } else {
        setActionError(json.message || common.errorLoad);
      }
    } finally {
      setRetryingSap(false);
    }
  }

  if (loading) return <PortalLoader fullScreen />;
  if (!po) return <p className="text-red-600">{error || actionError || detail.notFound}</p>;

  const displayError = actionError || error;

  const canApprove = po.canApproveCurrentStep === true;
  const approveHref = po.approveUrl || `/purchase-orders/${id}/approve`;
  const currentWorkflowStep = po.workflowSteps?.find((s) => s.state === 'current');
  const waitingForApproval =
    !canApprove &&
    isPendingPoApprovalStatus(po.status) &&
    currentWorkflowStep?.stepName;

  const tabs = [
    { id: 'details', label: common.details },
    { id: 'attachments', label: common.attachments },
    { id: 'comments', label: common.comments },
    { id: 'history', label: common.approvalHistory },
  ];

  return (
    <div className="space-y-6">
      {attachmentWarning && (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
          {attachmentWarning}
        </p>
      )}
      {displayError && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {displayError}
        </p>
      )}
      {po.workflowSteps?.length > 0 && (
        <WorkflowStepper steps={po.workflowSteps} documentType="PO" />
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/purchase-orders" className="text-primary hover:underline">
              {poI18n.title}
            </Link>
            {' / '}
            {po.portalPONumber}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">{po.portalPONumber}</h1>
          <div className="mt-2">
            <AnimatedStatusBadge status={po.status} />
          </div>
        </div>
        <div className="flex gap-2">
          {po.canEdit && !editing && (
            <button type="button" className="btn-secondary min-h-10" onClick={() => setEditing(true)}>
              {common.edit}
            </button>
          )}
          {canApprove && (
            <Link
              href={approveHref}
              className="btn-primary min-h-10"
              onClick={() => primePortalDocument('PO', id, po, userId)}
            >
              {common.approveReject}
            </Link>
          )}
          {waitingForApproval && (
            <span className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {common.waitingForApproval}: {currentWorkflowStep.stepName}
            </span>
          )}
          {po.canRetrySap && (
            <Button
              type="button"
              variant="secondary"
              className="min-h-10"
              loading={retryingSap}
              disabled={retryingSap}
              onClick={retrySap}
            >
              {retryingSap ? detail.retrying : common.retrySap}
            </Button>
          )}
        </div>
      </div>

      <AnimatedTabs tabs={tabs} activeId={activeTab} onChange={setActiveTab} className="max-w-2xl" />

      {activeTab === 'details' && editing && po.canEdit && (
        <PoEditForm
          po={po}
          onSaved={(data) => {
            setEditing(false);
            if (data) setDocument(data);
            else refresh();
          }}
          onCancel={() => setEditing(false)}
        />
      )}

      {activeTab === 'details' && !editing && (
        <>
          <section className="card grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              [detail.vendor, po.vendor],
              [detail.department, po.department],
              [detail.currency, po.docCurrency || null],
              [
                detail.exchangeRate,
                po.docCurrency === 'IQD' ? null : po.docRate != null ? po.docRate : null,
              ],
              [detail.relatedPr, po.relatedPRNumber],
              [detail.sapPr, po.relatedSAPPRDocNum],
              [detail.sapPo, po.sapPODocNum],
            ].map(([label, val]) => (
              <div key={label}>
                <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
                <p className="mt-1 text-sm">{val || '—'}</p>
              </div>
            ))}
            {po.relatedPRId && (
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">{detail.prLink}</p>
                <Link
                  href={`/purchase-requests/${po.relatedPRId}`}
                  className="mt-1 text-sm text-primary hover:underline"
                >
                  {detail.viewPr}
                </Link>
              </div>
            )}
            {po.sapErrorMessage && (
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase text-destructive">{detail.sapError}</p>
                <p className="mt-1 text-sm text-destructive">{po.sapErrorMessage}</p>
              </div>
            )}
            {po.sapWarnings && (
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase text-amber-600">{detail.sapWarnings}</p>
                <p className="mt-1 text-sm text-amber-800">{po.sapWarnings}</p>
              </div>
            )}
          </section>
          <section className="card overflow-x-auto">
            <h2 className="mb-4 text-lg font-semibold">{detail.lineItems}</h2>
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="pb-2 pr-4">{detail.item}</th>
                  <th className="pb-2 pr-4">{detail.qty}</th>
                  <th className="pb-2 pr-4">{detail.unitPrice}</th>
                  <th className="pb-2 pr-4">{detail.uomCode}</th>
                  <th className="pb-2 pr-4">{detail.warehouse}</th>
                  <th className="pb-2">{detail.total}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(po.lines || []).map((line, i) => (
                  <tr key={line._id || i}>
                    <td className="py-2 pr-4">
                      <span className="font-medium">{line.itemCode}</span>
                      <span className="ml-2 text-muted-foreground">{line.itemName}</span>
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
          canUpload={hasAnyPermission(PO_VIEW_PERMISSIONS)}
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
