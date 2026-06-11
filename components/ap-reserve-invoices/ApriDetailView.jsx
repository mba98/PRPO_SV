'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { PortalLoader, AnimatedStatusBadge } from '@/components/ui';
import { WorkflowStepper } from '@/components/workflow';
import AttachmentPanel from '@/components/attachments/AttachmentPanel';
import CommentsPanel from '@/components/comments/CommentsPanel';
import ApprovalTimeline from '@/components/approval-history/ApprovalTimeline';
import { useI18n } from '@/lib/hooks/useI18n';
import { readPortalDocument, cachePortalDocument } from '@/lib/documentClientCache';

export default function ApriDetailView({ id }) {
  const { common, detail, apri: apriI18n } = useI18n();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [apri, setApri] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const [retrying, setRetrying] = useState(false);
  const [emailLogs, setEmailLogs] = useState([]);
  const [emailLogsLoading, setEmailLogsLoading] = useState(false);

  const load = useCallback(async () => {
    const cached = readPortalDocument('APRI', id);
    if (cached) {
      setApri(cached);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { json } = await apiFetch(`/api/ap-reserve-invoices/${id}`);
    if (json.success) setApri(json.data);
    else setError(json.message || common.errorLoad);
    setLoading(false);
  }, [id, common.errorLoad]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (activeTab !== 'emails' || emailLogs.length || emailLogsLoading) return;
    (async () => {
      setEmailLogsLoading(true);
      const params = new URLSearchParams({
        relatedDocumentType: 'APRI',
        relatedDocumentId: id,
        limit: '50',
      });
      const { json } = await apiFetch(`/api/email/logs?${params}`);
      if (json.success) setEmailLogs(Array.isArray(json.data) ? json.data : []);
      setEmailLogsLoading(false);
    })();
  }, [activeTab, emailLogs.length, emailLogsLoading, id]);

  async function retrySap() {
    setRetrying(true);
    setError('');
    const { json } = await apiFetch(`/api/ap-reserve-invoices/${id}/retry-sap`, { method: 'POST' });
    setRetrying(false);
    if (json.success) load();
    else setError(json.message || common.errorLoad);
  }

  if (loading) return <PortalLoader fullScreen />;
  if (!apri) return <p className="text-red-600">{error || detail.notFound}</p>;

  const canRetry =
    apri.status === 'Failed to Create in SAP' &&
    (hasPermission('view.all') || hasPermission('admin.settings'));

  const canApprove = apri.canApproveCurrentStep === true;
  const currentWorkflowStep = apri.workflowSteps?.find((s) => s.state === 'current');
  const waitingForApproval =
    !canApprove &&
    currentWorkflowStep?.stepName &&
    apri.status !== 'Rejected' &&
    apri.status !== 'Created in SAP' &&
    !apri.status?.includes('Failed');

  const tabs = [
    { id: 'details', label: common.details },
    { id: 'attachments', label: common.attachments },
    { id: 'comments', label: common.comments },
    { id: 'history', label: common.approvalHistory },
    { id: 'emails', label: common.emails },
  ];

  const canUploadAttachments =
    canApprove ||
    hasPermission('apinvoice.create') ||
    hasPermission('view.all');

  return (
    <div className="space-y-6">
      {apri.workflowSteps?.length > 0 && (
        <WorkflowStepper steps={apri.workflowSteps} documentType="APRI" />
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/ap-reserve-invoices" className="text-primary hover:underline">
              {apriI18n.title}
            </Link>
            {' / '}
            {apri.portalAPNumber}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">{apri.portalAPNumber}</h1>
          <div className="mt-2">
            <AnimatedStatusBadge status={apri.status} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canApprove && (
            <Link
              href={`/ap-reserve-invoices/${id}/approve`}
              className="btn-primary min-h-10"
              onClick={() => cachePortalDocument('APRI', id, apri)}
            >
              {common.approveReject}
            </Link>
          )}
          {waitingForApproval && (
            <span className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {common.waitingForApproval}: {currentWorkflowStep.stepName}
            </span>
          )}
          {canRetry && (
            <button type="button" className="btn-secondary" onClick={retrySap} disabled={retrying}>
              {retrying ? detail.retrying : detail.retrySap}
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === t.id
                ? 'border-b-2 border-brand-600 text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'details' && (
        <>
          <section className="card grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              [detail.vendor, apri.vendor],
              [detail.relatedPo, apri.relatedPONumber],
              [detail.sapPoDocEntry, apri.relatedSAPPODocEntry],
              [detail.sapPoDocNum, apri.relatedSAPPODocNum],
              [detail.sapApDocNum, apri.sapAPDocNum],
              [detail.sapApDocEntry, apri.sapAPDocEntry],
            ].map(([label, val]) => (
              <div key={label}>
                <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
                <p className="mt-1 text-sm">{val ?? '—'}</p>
              </div>
            ))}
            {apri.relatedPO?.id && (
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">{detail.poLink}</p>
                <Link
                  href={`/purchase-orders/${apri.relatedPO.id}`}
                  className="mt-1 text-sm text-primary hover:underline"
                >
                  {detail.viewPo}
                </Link>
              </div>
            )}
            {apri.sapErrorMessage && (
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase text-destructive">{detail.sapError}</p>
                <p className="mt-1 text-sm text-destructive">{apri.sapErrorMessage}</p>
              </div>
            )}
          </section>

          <section className="card overflow-x-auto">
            <h2 className="mb-4 text-lg font-semibold">{detail.lineItems}</h2>
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="pb-2 pr-4">{detail.item}</th>
                  <th className="pb-2 pr-4">{detail.poLine}</th>
                  <th className="pb-2 pr-4">{detail.qty}</th>
                  <th className="pb-2">{detail.total}</th>
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
          {emailLogsLoading ? (
            <p className="text-sm text-muted-foreground">{common.loading}</p>
          ) : emailLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{detail.noEmailLogs}</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="pb-2 pr-4">{detail.emailTo}</th>
                  <th className="pb-2 pr-4">{detail.emailSubject}</th>
                  <th className="pb-2 pr-4">{detail.emailStatus}</th>
                  <th className="pb-2">{detail.emailSent}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {emailLogs.map((e) => (
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
