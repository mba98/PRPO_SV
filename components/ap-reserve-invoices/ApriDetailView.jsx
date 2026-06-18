'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { PortalLoader, AnimatedStatusBadge, Button } from '@/components/ui';
import { WorkflowStepper } from '@/components/workflow';
import AttachmentPanel from '@/components/attachments/AttachmentPanel';
import CommentsPanel from '@/components/comments/CommentsPanel';
import ApprovalTimeline from '@/components/approval-history/ApprovalTimeline';
import { useI18n } from '@/lib/hooks/useI18n';
import { usePortalDocument } from '@/lib/hooks/usePortalDocument';
import { primePortalDocument } from '@/lib/documentClientCache';
import { APRI_STATUS, normalizeApriStatus } from '@/lib/apriStatus.js';

export default function ApriDetailView({ id }) {
  const { common, detail, apri: apriI18n } = useI18n();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const userId = useAuthStore((s) => s.user?.id);
  const { doc: apri, loading, error, refresh, setDocument } = usePortalDocument(
    'APRI',
    id,
    'ApriDetailView',
  );
  const [actionError, setActionError] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const [retrying, setRetrying] = useState(false);
  const [creatingSap, setCreatingSap] = useState(false);
  const [savingQty, setSavingQty] = useState(false);
  const [lineQty, setLineQty] = useState({});
  const [emailLogs, setEmailLogs] = useState([]);
  const [emailLogsLoading, setEmailLogsLoading] = useState(false);

  useEffect(() => {
    if (!apri?.lines?.length) return;
    const next = {};
    for (const line of apri.lines) {
      if (line._id) next[line._id] = line.quantity;
    }
    setLineQty(next);
  }, [apri?.lines, apri?.__v]);

  useEffect(() => {
    if (activeTab !== 'emails' || emailLogs.length || emailLogsLoading) return;
    (async () => {
      setEmailLogsLoading(true);
      const params = new URLSearchParams({
        relatedDocumentType: 'APRI',
        relatedDocumentId: id,
        limit: '50',
      });
      const { json } = await apiFetch(`/api/email/logs?${params}`, { source: 'ApriDetailView:emails' });
      if (json.success) setEmailLogs(Array.isArray(json.data) ? json.data : []);
      setEmailLogsLoading(false);
    })();
  }, [activeTab, emailLogs.length, emailLogsLoading, id]);

  async function retrySap() {
    setRetrying(true);
    setActionError('');
    const { json } = await apiFetch(`/api/ap-reserve-invoices/${id}/retry-sap`, {
      method: 'POST',
      body: JSON.stringify({ __v: apri.__v }),
      dedupe: false,
    });
    setRetrying(false);
    if (json.success) {
      const next = json.data?.apri || json.data;
      if (next) setDocument(next);
      else await refresh();
    } else {
      setActionError(json.message || common.errorLoad);
    }
  }

  async function createInSap() {
    if (creatingSap) return;
    setCreatingSap(true);
    setActionError('');
    const { json, status } = await apiFetch(`/api/ap-reserve-invoices/${id}/create-in-sap`, {
      method: 'POST',
      body: JSON.stringify({ __v: apri.__v }),
      dedupe: false,
      source: 'ApriDetailView:createInSap',
    });
    setCreatingSap(false);
    if (json.success) {
      const next = json.data?.apri;
      if (next) setDocument(next);
      else await refresh();
    } else if (status === 409 && json.error === 'APRI_ALREADY_CREATING_OR_CREATED') {
      setActionError(json.message);
      await refresh();
    } else {
      setActionError(json.message || common.errorLoad);
      if (json.data?.apri) setDocument(json.data.apri);
      else await refresh();
    }
  }

  async function saveQuantities() {
    if (savingQty) return;
    setSavingQty(true);
    setActionError('');
    const lines = (apri.lines || []).map((line) => ({
      _id: line._id,
      quantity: Number(lineQty[line._id] ?? line.quantity),
    }));
    const { json } = await apiFetch(`/api/ap-reserve-invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ lines, __v: apri.__v }),
      dedupe: false,
    });
    setSavingQty(false);
    if (json.success) {
      setDocument(json.data);
      primePortalDocument('APRI', id, json.data, userId);
    } else {
      setActionError(json.message || common.errorLoad);
    }
  }

  if (loading) return <PortalLoader fullScreen />;
  if (!apri) return <p className="text-red-600">{error || actionError || detail.notFound}</p>;

  const displayError = actionError || error;
  const normStatus = normalizeApriStatus(apri.status);

  const canApprove = apri.canApproveCurrentStep === true;
  const approveHref = apri.approveUrl || `/ap-reserve-invoices/${id}/approve`;
  const canCreateInSap = apri.canCreateInSap === true;
  const canEditQuantities = apri.canEditQuantities === true;
  const canRetry = apri.canRetrySap === true;

  const waitingForWarehouse =
    normStatus === APRI_STATUS.PENDING_WAREHOUSE && !canApprove && hasPermission('apinvoice.create');

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
              href={approveHref}
              className="btn-primary min-h-10"
              onClick={() => primePortalDocument('APRI', id, apri, userId)}
            >
              {common.approveReject}
            </Link>
          )}
          {waitingForWarehouse && (
            <span className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              {apriI18n.waitingForWarehouse}
            </span>
          )}
          {normStatus === APRI_STATUS.CREATING_IN_SAP && (
            <span className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:bg-blue-500/10 dark:text-blue-200">
              {apriI18n.creatingInSap}
            </span>
          )}
          {canCreateInSap && (
            <Button type="button" variant="primary" loading={creatingSap} onClick={createInSap}>
              {creatingSap ? apriI18n.creatingInSap : apriI18n.createInSap}
            </Button>
          )}
          {canRetry && (
            <button type="button" className="btn-secondary" onClick={retrySap} disabled={retrying}>
              {retrying ? detail.retrying : detail.retrySap}
            </button>
          )}
        </div>
      </div>

      {normStatus === APRI_STATUS.WAREHOUSE_APPROVED && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-200">
          {apriI18n.warehouseApproved}
        </p>
      )}
      {normStatus === APRI_STATUS.WAREHOUSE_REJECTED && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
          {apriI18n.warehouseRejected}
        </p>
      )}

      {displayError && <p className="text-sm text-red-600">{displayError}</p>}

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
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{detail.lineItems}</h2>
              {canEditQuantities && (
                <Button type="button" variant="secondary" loading={savingQty} onClick={saveQuantities}>
                  {apriI18n.saveQuantities}
                </Button>
              )}
            </div>
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
                    <td className="py-2 pr-4">
                      {canEditQuantities && line._id ? (
                        <input
                          type="number"
                          min="0.0001"
                          step="any"
                          className="input-field h-9 w-28"
                          value={lineQty[line._id] ?? line.quantity}
                          onChange={(e) =>
                            setLineQty((prev) => ({ ...prev, [line._id]: e.target.value }))
                          }
                        />
                      ) : (
                        line.quantity
                      )}
                    </td>
                    <td className="py-2">{line.lineTotal ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      {activeTab === 'attachments' && (
        <AttachmentPanel documentType="APRI" documentId={id} canUpload={canUploadAttachments} />
      )}

      {activeTab === 'comments' && <CommentsPanel documentType="APRI" documentId={id} />}

      {activeTab === 'history' && <ApprovalTimeline documentType="APRI" documentId={id} />}

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
