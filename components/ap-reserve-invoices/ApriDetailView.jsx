'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  buildLineQtyMap,
  lineQtyMapsEqual,
  normalizeQuantity,
} from '@/lib/apriDetailQuantityState.js';

import { APRI_STATUS, normalizeApriStatus } from '@/lib/apriStatus.js';

function applyApriUpdatePayload(setDocument, payload, userId, id) {
  const doc = payload?.document || payload;
  const merged = {
    ...doc,
    canCreateInSap: payload?.canCreateInSap ?? doc?.canCreateInSap ?? false,
    canEditQuantities: payload?.canEditQuantities ?? doc?.canEditQuantities ?? false,
    canRetrySap: payload?.canRetrySap ?? doc?.canRetrySap ?? false,
  };
  setDocument(merged);
  primePortalDocument('APRI', id, merged, userId);
  return merged;
}

function isSapCreatableStatus(status) {
  const norm = normalizeApriStatus(status);
  return norm === APRI_STATUS.WAREHOUSE_APPROVED || norm === APRI_STATUS.WAREHOUSE_REJECTED;
}

export default function ApriDetailView({ id }) {
  const { common, detail, apri: apriI18n, locale } = useI18n();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const userId = useAuthStore((s) => s.user?.id);
  const { doc: apri, loading, error, refresh, setDocument } = usePortalDocument(
    'APRI',
    id,
    'ApriDetailView',
  );
  const apriRef = useRef(apri);
  const skipQtyBaselineSyncRef = useRef(false);

  const [actionError, setActionError] = useState('');
  const [lineFieldErrors, setLineFieldErrors] = useState({});
  const [activeTab, setActiveTab] = useState('details');
  const [retrying, setRetrying] = useState(false);
  const [creatingSap, setCreatingSap] = useState(false);
  const [savingQty, setSavingQty] = useState(false);
  const [lineQty, setLineQty] = useState({});
  const [savedLineQty, setSavedLineQty] = useState({});
  const [emailLogs, setEmailLogs] = useState([]);
  const [emailLogsLoading, setEmailLogsLoading] = useState(false);

  apriRef.current = apri;

  useEffect(() => {
    if (!apri?.id) return;
    if (skipQtyBaselineSyncRef.current) {
      skipQtyBaselineSyncRef.current = false;
      return;
    }
    if (!apri?.lines?.length) return;
    const baseline = buildLineQtyMap(apri.lines);
    setLineQty(baseline);
    setSavedLineQty(baseline);
    setLineFieldErrors({});
  }, [apri?.id, apri?.__v, apri?.lines]);

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

  const lineValidations = useMemo(() => {
    if (!apri?.lines?.length) return {};
    const next = {};
    for (const line of apri.lines) {
      if (!line._id) continue;
      const raw = lineQty[line._id] ?? line.quantity;
      const qty = normalizeQuantity(raw);
      const max = Number(line.remainingPoQuantity ?? line.poQuantity ?? 0);
      let message = '';
      if (raw === '' || qty == null) {
        message = apriI18n.invalidQuantity;
      } else if (qty <= 0) {
        message = apriI18n.quantityMustBePositive;
      } else if (Number.isFinite(max) && qty > max) {
        message = apriI18n.quantityExceedsMaximum.replace('{max}', String(max));
      }
      next[line._id] = { qty, max, valid: !message, message };
    }
    return next;
  }, [apri?.lines, lineQty, apriI18n]);

  const hasUnsavedQtyChanges = useMemo(
    () => !lineQtyMapsEqual(lineQty, savedLineQty),
    [lineQty, savedLineQty],
  );

  const hasQuantityErrors = useMemo(
    () => Object.values(lineValidations).some((v) => !v.valid),
    [lineValidations],
  );

  const allLinesValid = !hasQuantityErrors;

  const displayDocumentTotal = useMemo(() => {
    if (!apri?.lines?.length) return 0;
    return apri.lines.reduce((sum, line) => {
      const validation = lineValidations[line._id];
      const qty = validation?.qty ?? normalizeQuantity(line.quantity);
      const unitPrice = Number(line.unitPrice);
      if (qty != null && Number.isFinite(unitPrice)) {
        return sum + qty * unitPrice;
      }
      const total = Number(line.lineTotal);
      return sum + (Number.isFinite(total) ? total : 0);
    }, 0);
  }, [apri?.lines, lineValidations]);

  const normStatus = normalizeApriStatus(apri?.status);
  const canCreateInSap = apri?.canCreateInSap === true;
  const canEditQuantities = apri?.canEditQuantities === true;
  const canRetry = apri?.canRetrySap === true;
  const hasSapCreatePermission = hasPermission('apri.create.sap');

  const showCreateInSap =
    isSapCreatableStatus(normStatus) &&
    hasSapCreatePermission &&
    (canCreateInSap || canEditQuantities);

  const createInSapEnabled =
    canCreateInSap &&
    isSapCreatableStatus(normStatus) &&
    !hasUnsavedQtyChanges &&
    !hasQuantityErrors &&
    !savingQty &&
    !creatingSap;

  const createInSapDisabledReason = useMemo(() => {
    if (!showCreateInSap) return '';
    if (creatingSap) return apriI18n.creatingInSap;
    if (savingQty) return common.loading;
    if (!hasSapCreatePermission) return apriI18n.noCreateSapPermission;
    if (!canCreateInSap && !canEditQuantities) return apriI18n.noCreateSapPermission;
    if (hasUnsavedQtyChanges) return apriI18n.saveBeforeCreateInSap;
    if (hasQuantityErrors) return apriI18n.invalidQuantitySaveFirst;
    if (normStatus === APRI_STATUS.CREATING_IN_SAP) return apriI18n.alreadyCreatingInSap;
    if (!canCreateInSap) return apriI18n.createInSapNotReady;
    return '';
  }, [
    showCreateInSap,
    creatingSap,
    savingQty,
    hasSapCreatePermission,
    canCreateInSap,
    canEditQuantities,
    hasUnsavedQtyChanges,
    hasQuantityErrors,
    normStatus,
    apriI18n,
    common.loading,
  ]);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development' || !apri) return;
    console.log('APRI Create in SAP state', {
      status: apri.status,
      normalizedStatus: normStatus,
      canCreateInSap,
      canEditQuantities,
      hasUnsavedQtyChanges,
      isSavingQuantities: savingQty,
      isCreatingInSap: creatingSap,
      hasQuantityErrors,
      hasSapCreatePermission,
      documentVersion: apri.__v,
      createInSapEnabled,
      createInSapDisabledReason,
      lineQty,
      savedLineQty,
    });
  }, [
    apri,
    normStatus,
    canCreateInSap,
    canEditQuantities,
    hasUnsavedQtyChanges,
    savingQty,
    creatingSap,
    hasQuantityErrors,
    hasSapCreatePermission,
    createInSapEnabled,
    createInSapDisabledReason,
    lineQty,
    savedLineQty,
  ]);

  async function retrySap() {
    setRetrying(true);
    setActionError('');
    const current = apriRef.current;
    const { json } = await apiFetch(`/api/ap-reserve-invoices/${id}/retry-sap`, {
      method: 'POST',
      body: JSON.stringify({ __v: current.__v }),
      dedupe: false,
    });
    setRetrying(false);
    if (json.success) {
      const next = json.data?.apri || json.data?.document || json.data;
      if (next) setDocument(next);
      else await refresh();
    } else {
      setActionError(json.message || common.errorLoad);
    }
  }

  async function handleCreateInSap() {
    if (!createInSapEnabled) return;
    const current = apriRef.current;
    if (creatingSap || !current) return;

    setCreatingSap(true);
    setActionError('');
    const { json, status } = await apiFetch(`/api/ap-reserve-invoices/${id}/create-in-sap`, {
      method: 'POST',
      body: JSON.stringify({ __v: current.__v }),
      dedupe: false,
      source: 'ApriDetailView:createInSap',
    });
    setCreatingSap(false);

    if (json.success) {
      const next = json.data?.apri || json.data?.document || json.data;
      if (next) {
        applyApriUpdatePayload(setDocument, { document: next, ...next }, userId, id);
      } else {
        await refresh();
      }
    } else if (status === 409) {
      setActionError(json.message || common.errorLoad);
      await refresh();
    } else {
      setActionError(json.message || common.errorLoad);
      if (json.data?.document) {
        applyApriUpdatePayload(setDocument, json.data, userId, id);
      } else if (json.data?.apri) {
        setDocument(json.data.apri);
      }
    }
  }

  async function saveQuantities() {
    if (savingQty || !allLinesValid || !hasUnsavedQtyChanges) return;
    const current = apriRef.current;
    setSavingQty(true);
    setActionError('');
    setLineFieldErrors({});

    const lines = (current.lines || []).map((line) => ({
      _id: line._id,
      quantity: normalizeQuantity(lineQty[line._id] ?? line.quantity),
    }));

    const { json } = await apiFetch(`/api/ap-reserve-invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ lines, __v: current.__v }),
      dedupe: false,
    });
    setSavingQty(false);

    if (json.success) {
      skipQtyBaselineSyncRef.current = true;
      const merged = applyApriUpdatePayload(setDocument, json.data, userId, id);
      const baseline = buildLineQtyMap(merged.lines);
      setSavedLineQty(baseline);
      setLineQty(baseline);
      setLineFieldErrors({});
    } else {
      setActionError(json.message || common.errorLoad);
      const nextLineErrors = {};
      for (const err of json.errors || []) {
        if (err.lineId) nextLineErrors[err.lineId] = err.message;
      }
      setLineFieldErrors(nextLineErrors);
    }
  }

  if (loading) return <PortalLoader fullScreen />;
  if (!apri) return <p className="text-red-600">{error || actionError || detail.notFound}</p>;

  const displayError = actionError || error;
  const canApprove = apri.canApproveCurrentStep === true;
  const approveHref = apri.approveUrl || `/ap-reserve-invoices/${id}/approve`;

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
        <div className="flex flex-col items-end gap-1">
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
            {showCreateInSap && (
              <Button
                type="button"
                variant="primary"
                loading={creatingSap}
                disabled={!createInSapEnabled}
                onClick={handleCreateInSap}
              >
                {creatingSap ? apriI18n.creatingInSap : apriI18n.createInSap}
              </Button>
            )}
            {canRetry && (
              <button type="button" className="btn-secondary" onClick={retrySap} disabled={retrying}>
                {retrying ? detail.retrying : detail.retrySap}
              </button>
            )}
          </div>
          {showCreateInSap && !createInSapEnabled && createInSapDisabledReason && (
            <p className="max-w-md text-right text-xs text-muted-foreground">
              {createInSapDisabledReason}
            </p>
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
              [detail.total, displayDocumentTotal.toLocaleString(locale === 'ar' ? 'ar' : 'en')],
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
                <Button
                  type="button"
                  variant="secondary"
                  loading={savingQty}
                  disabled={!allLinesValid || !hasUnsavedQtyChanges}
                  onClick={saveQuantities}
                >
                  {apriI18n.saveQuantities}
                </Button>
              )}
            </div>
            {canEditQuantities && hasUnsavedQtyChanges && (
              <p className="mb-4 text-sm text-amber-800 dark:text-amber-200">
                {apriI18n.saveBeforeCreateInSap}
              </p>
            )}
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
                {(apri.lines || []).map((line, i) => {
                  const validation = lineValidations[line._id] || {};
                  const lineError = lineFieldErrors[line._id] || validation.message;
                  const maxQty = line.remainingPoQuantity ?? line.poQuantity;
                  const qty = validation.qty ?? normalizeQuantity(line.quantity);
                  const unitPrice = Number(line.unitPrice);
                  const displayTotal =
                    qty != null && Number.isFinite(unitPrice) ? qty * unitPrice : line.lineTotal;

                  return (
                    <tr
                      key={line._id || i}
                      className={lineError ? 'bg-red-50/60 dark:bg-red-500/5' : undefined}
                    >
                      <td className="py-2 pr-4">
                        <span className="font-medium">{line.itemCode}</span>
                        <span className="ml-2 text-muted-foreground">{line.itemName}</span>
                      </td>
                      <td className="py-2 pr-4">{line.relatedPOLineNum ?? '—'}</td>
                      <td className="py-2 pr-4 align-top">
                        {canEditQuantities && line._id ? (
                          <div className="space-y-1">
                            <input
                              type="number"
                              min={0.000001}
                              max={maxQty}
                              step="any"
                              className={`input-field h-9 w-28 ${lineError ? 'border-red-500' : ''}`}
                              value={lineQty[line._id] ?? line.quantity ?? ''}
                              onChange={(e) => {
                                const nextValue = e.target.value;
                                setLineQty((prev) => ({ ...prev, [line._id]: nextValue }));
                                setLineFieldErrors((prev) => {
                                  const next = { ...prev };
                                  delete next[line._id];
                                  return next;
                                });
                              }}
                            />
                            {maxQty != null && (
                              <p className="text-xs text-muted-foreground">
                                {apriI18n.maximumAvailable}: {maxQty}
                              </p>
                            )}
                            {lineError && <p className="text-xs text-red-600">{lineError}</p>}
                          </div>
                        ) : (
                          line.quantity
                        )}
                      </td>
                      <td className="py-2">{displayTotal ?? '—'}</td>
                    </tr>
                  );
                })}
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
