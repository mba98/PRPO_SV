'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { PortalLoader, AnimatedStatusBadge, AnimatedTabs, Button } from '@/components/ui';
import { useI18n } from '@/lib/hooks/useI18n';
import { WorkflowStepper } from '@/components/workflow';
import CreatePoFromPrPanel from '@/components/purchase-requests/CreatePoFromPrPanel';
import AttachmentPanel from '@/components/attachments/AttachmentPanel';
import CommentsPanel from '@/components/comments/CommentsPanel';
import ApprovalTimeline from '@/components/approval-history/ApprovalTimeline';

export default function PrDetailView({ id }) {
  const { common, detail, pr: prI18n } = useI18n();
  const searchParams = useSearchParams();
  const attachmentWarning = searchParams.get('attachmentWarning');
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [pr, setPr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retryingSap, setRetryingSap] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('details');

  useEffect(() => {
    if (attachmentWarning) setActiveTab('attachments');
  }, [attachmentWarning]);

  const load = useCallback(async () => {
    setLoading(true);
    const { json: prJson } = await apiFetch(`/api/purchase-requests/${id}`);
    if (prJson.success) setPr(prJson.data);
    else setError(prJson.message || common.errorLoad);
    setLoading(false);
  }, [id, common.errorLoad]);

  useEffect(() => {
    load();
  }, [load]);

  async function retrySap() {
    if (retryingSap) return;
    setRetryingSap(true);
    setError('');
    try {
      const { json } = await apiFetch(`/api/purchase-requests/${id}/retry-sap`, {
        method: 'POST',
      });
      if (json.success) {
        await load();
      } else {
        setError(json.message || common.errorLoad);
      }
    } finally {
      setRetryingSap(false);
    }
  }

  if (loading) return <PortalLoader fullScreen />;
  if (!pr) return <p className="text-red-600">{error || detail.notFound}</p>;

  const canApprove = pr.canApproveCurrentStep === true;
  const canRetrySap = pr.canRetrySap === true;
  const showRetryDeniedNote = pr.status === 'Failed to Create in SAP' && !canRetrySap;
  const currentWorkflowStep = pr.workflowSteps?.find((s) => s.state === 'current');
  const waitingForApproval =
    !canApprove &&
    ['Pending Warehouse Approval', 'Pending Project Manager Approval'].includes(pr.status) &&
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
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {pr.workflowSteps?.length > 0 && (
        <WorkflowStepper steps={pr.workflowSteps} documentType="PR" />
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/purchase-requests" className="text-primary hover:underline">
              {prI18n.title}
            </Link>
            {' / '}
            {pr.portalPRNumber}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">{pr.portalPRNumber}</h1>
          <div className="mt-2">
            <AnimatedStatusBadge status={pr.status} />
          </div>
        </div>
        <div className="flex gap-2">
          {canApprove && (
            <Link href={`/purchase-requests/${id}/approve`} className="btn-primary min-h-10">
              {common.approveReject}
            </Link>
          )}
          {waitingForApproval && (
            <span className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {common.waitingFor} {currentWorkflowStep.stepName}
            </span>
          )}
          {canRetrySap && (
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

      {activeTab === 'details' && (
        <>
          {pr.canCreatePo && <CreatePoFromPrPanel pr={pr} />}

          <section className="card grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              [detail.requester, pr.requesterName || pr.requesterEmail],
              [detail.requesterSapCode, pr.requesterSapRequesterCode || '—'],
              [
                detail.requiredDate,
                pr.requiredDate ? new Date(pr.requiredDate).toLocaleDateString() : '—',
              ],
              [
                detail.documentDate,
                pr.documentDate ? new Date(pr.documentDate).toLocaleDateString() : '—',
              ],
              [detail.dueDate, pr.dueDate ? new Date(pr.dueDate).toLocaleDateString() : '—'],
              [detail.sapPrDocNum, pr.sapPRDocNum || '—'],
              [detail.sapPrDocEntry, pr.sapPRDocEntry || '—'],
            ].map(([label, val]) => (
              <div key={label}>
                <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
                <p className="mt-1 text-sm text-foreground">{val || '—'}</p>
              </div>
            ))}
            {pr.remarks && (
              <div className="sm:col-span-2 lg:col-span-3">
                <p className="text-xs font-medium uppercase text-muted-foreground">{detail.remarks}</p>
                <p className="mt-1 text-sm text-foreground">{pr.remarks}</p>
              </div>
            )}
            {pr.status === 'Failed to Create in SAP' && (
              <div className="sm:col-span-2 lg:col-span-3 rounded-md border border-rose-200 border border-destructive/30 bg-destructive/10 px-4 py-3">
                <p className="text-xs font-medium uppercase text-destructive">{detail.sapFailed}</p>
                {pr.sapErrorMessage && (
                  <p className="mt-1 text-sm text-destructive">{pr.sapErrorMessage}</p>
                )}
                {pr.sapReferenceSummary && (
                  <p className="mt-2 text-xs text-rose-900/90 font-mono break-all">
                    {pr.sapReferenceSummary}
                  </p>
                )}
                {pr.requesterMissingSapCode && (
                  <p className="mt-2 text-sm text-destructive">
                    {detail.requesterMissingSap}
                  </p>
                )}
                {showRetryDeniedNote && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {detail.sapRetryAdmin}
                  </p>
                )}
              </div>
            )}
          </section>

          <section className="card overflow-x-auto">
            <h2 className="mb-4 text-lg font-semibold">{detail.lineItems}</h2>
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="pb-2 pr-4">{detail.item}</th>
                  <th className="pb-2 pr-4">{detail.warehouse}</th>
                  <th className="pb-2 pr-4">{detail.qty}</th>
                  <th className="pb-2 pr-4">{detail.uomCode}</th>
                  <th className="pb-2 pr-4">{detail.unitPrice}</th>
                  <th className="pb-2 pr-4">{detail.total}</th>
                  <th className="pb-2">{detail.vendor}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(pr.lines || []).map((line, i) => (
                  <tr key={line._id || i}>
                    <td className="py-2 pr-4">
                      <span className="font-medium">{line.itemCode}</span>
                      <span className="ml-2 text-muted-foreground">{line.itemName}</span>
                    </td>
                    <td className="py-2 pr-4">{line.warehouseCode || '—'}</td>
                    <td className="py-2 pr-4">{line.quantity}</td>
                    <td className="py-2 pr-4">{line.uomCode || line.uom || '—'}</td>
                    <td className="py-2 pr-4">{line.estimatedUnitPrice ?? '—'}</td>
                    <td className="py-2 pr-4">{line.estimatedTotal ?? '—'}</td>
                    <td className="py-2">{line.vendor || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      {activeTab === 'attachments' && (
        <AttachmentPanel
          documentType="PR"
          documentId={id}
          canUpload={
            hasPermission('pr.create') ||
            hasPermission('pr.approve.whs') ||
            hasPermission('pr.approve.pm') ||
            hasPermission('view.all')
          }
          approvalStep={pr.currentApprovalStep}
        />
      )}

      {activeTab === 'comments' && (
        <CommentsPanel documentType="PR" documentId={id} />
      )}

      {activeTab === 'history' && (
        <ApprovalTimeline documentType="PR" documentId={id} />
      )}
    </div>
  );
}
