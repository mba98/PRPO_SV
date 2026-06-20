'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/apiClient';
import { usePortalDocument } from '@/lib/hooks/usePortalDocument';
import { PortalLoader, AnimatedStatusBadge, Button } from '@/components/ui';
import { WorkflowStepper } from '@/components/workflow';
import AttachmentPanel from '@/components/attachments/AttachmentPanel';
import CommentsPanel from '@/components/comments/CommentsPanel';
import ApprovalTimeline from '@/components/approval-history/ApprovalTimeline';
import { useI18n } from '@/lib/hooks/useI18n';
import { formatMoneyWithCurrency } from '@/lib/lpMoney';
import { extractLocalPurchaseDocument } from '@/lib/localPurchaseDocument.js';
import { primePortalDocument } from '@/lib/documentClientCache';
import { useAuthStore } from '@/stores/authStore';

export default function LpDetailView({ id }) {
  const { common, lp: lpI18n, detail } = useI18n();
  const userId = useAuthStore((s) => s.user?.id);
  const { doc, loading, error, refresh, setDocument } = usePortalDocument('LOCAL_PURCHASE', id, 'LpDetailView');
  const [activeTab, setActiveTab] = useState('details');
  const [actionError, setActionError] = useState('');
  const [acting, setActing] = useState(false);
  const [emailLogs, setEmailLogs] = useState([]);
  const [emailLogsLoading, setEmailLogsLoading] = useState(false);
  const [emailLogsError, setEmailLogsError] = useState('');
  const emailFetchStateRef = useRef('idle');

  useEffect(() => {
    emailFetchStateRef.current = 'idle';
    setEmailLogs([]);
    setEmailLogsError('');
    setEmailLogsLoading(false);
  }, [id]);

  useEffect(() => {
    if (activeTab !== 'emails') return;
    if (emailFetchStateRef.current !== 'idle') return;

    emailFetchStateRef.current = 'loading';
    setEmailLogsLoading(true);
    setEmailLogsError('');

    (async () => {
      try {
        const params = new URLSearchParams({
          relatedDocumentType: 'LOCAL_PURCHASE',
          relatedDocumentId: id,
          limit: '50',
        });
        const { json, status } = await apiFetch(`/api/email/logs?${params}`, {
          source: 'LpDetailView:emails',
        });

        if (status === 403 || json.error === 'FORBIDDEN' || json.error === 'INSUFFICIENT_PERMISSION') {
          emailFetchStateRef.current = 'forbidden';
          setEmailLogsError(detail.emailLogsForbidden);
          return;
        }

        if (json.success) {
          setEmailLogs(Array.isArray(json.data) ? json.data : []);
          emailFetchStateRef.current = 'done';
        } else {
          setEmailLogsError(json.message || common.errorLoad);
          emailFetchStateRef.current = 'done';
        }
      } catch {
        setEmailLogsError(common.errorLoad);
        emailFetchStateRef.current = 'done';
      } finally {
        setEmailLogsLoading(false);
      }
    })();
    // Intentionally depend only on tab + document id to avoid refetch loops from i18n object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, id]);

  if (loading) return <PortalLoader />;
  if (error || !doc) return <p className="text-sm text-red-600">{error || common.errorLoad}</p>;

  const tabs = [
    { id: 'details', label: common.details },
    { id: 'attachments', label: common.attachments },
    { id: 'comments', label: common.comments },
    { id: 'history', label: common.approvalHistory },
    { id: 'emails', label: common.emails },
  ];

  async function handleCancel() {
    setActing(true);
    setActionError('');
    const { json } = await apiFetch(`/api/local-purchases/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ __v: doc.__v }),
      source: 'LpDetailView:cancel',
      dedupe: false,
    });
    setActing(false);
    if (!json.success) {
      setActionError(json.message || lpI18n.cancelFailed);
      return;
    }
    const updated = extractLocalPurchaseDocument(json.data);
    if (updated) {
      setDocument(updated);
      primePortalDocument('LOCAL_PURCHASE', id, updated, userId);
    } else {
      await refresh();
    }
  }

  const currency = doc.currency || 'IQD';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{lpI18n.portalNumber}</p>
          <h2 className="text-2xl font-semibold">{doc.portalLPNumber}</h2>
          <AnimatedStatusBadge status={doc.status} className="mt-2" />
        </div>
        <div className="flex flex-wrap gap-2">
          {doc.canApproveCurrentStep && (
            <Link href={`/local-purchases/${id}/approve`} className="btn-primary">
              {common.approveReject}
            </Link>
          )}
          {doc.canEdit && (
            <Link href={`/local-purchases/${id}/edit`} className="btn-secondary">
              {common.edit}
            </Link>
          )}
          {doc.canSubmit && doc.status === 'draft' && (
            <Link href={`/local-purchases/${id}/edit`} className="btn-secondary">
              {lpI18n.submitForApproval}
            </Link>
          )}
          {doc.canResubmit && (
            <Link href={`/local-purchases/${id}/edit`} className="btn-secondary">
              {lpI18n.resubmit}
            </Link>
          )}
          {doc.canCancel && (
            <Button type="button" variant="ghost" loading={acting} onClick={handleCancel}>
              {lpI18n.cancelDocument}
            </Button>
          )}
        </div>
      </div>

      {doc.rejectionReason && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
          {lpI18n.rejectionReason}: {doc.rejectionReason}
        </p>
      )}

      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      <WorkflowStepper steps={doc.workflowSteps || []} />

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
        <div className="space-y-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">{lpI18n.requestDate}</dt>
              <dd>{doc.documentDate ? new Date(doc.documentDate).toLocaleDateString() : '—'}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">{lpI18n.currency}</dt>
              <dd>{currency}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">{lpI18n.budget}</dt>
              <dd>{formatMoneyWithCurrency(doc.budget ?? 0, currency)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm text-muted-foreground">{lpI18n.generalRemarks}</dt>
              <dd>{doc.remarks || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">{common.status}</dt>
              <dd>
                <AnimatedStatusBadge status={doc.status} />
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">{lpI18n.createdBy}</dt>
              <dd>{doc.createdByName || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">{common.createdAt}</dt>
              <dd>{doc.createdAt ? new Date(doc.createdAt).toLocaleString() : '—'}</dd>
            </div>
          </dl>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{lpI18n.item}</th>
                  <th>{lpI18n.quantity}</th>
                  <th>{lpI18n.estimatedPrice}</th>
                  <th>{lpI18n.lineNotes}</th>
                  <th>{lpI18n.lineTotal}</th>
                </tr>
              </thead>
              <tbody>
                {(doc.lines || []).map((line) => (
                  <tr key={line._id}>
                    <td>{line.description}</td>
                    <td>{line.quantity}</td>
                    <td>{formatMoneyWithCurrency(line.unitPrice, currency)}</td>
                    <td>{line.notes || '—'}</td>
                    <td>{formatMoneyWithCurrency(line.lineTotal, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-right font-semibold">
            {lpI18n.documentTotal}: {formatMoneyWithCurrency(doc.documentTotal || 0, currency)}
          </p>
        </div>
      )}

      {activeTab === 'attachments' && (
        <AttachmentPanel documentType="LOCAL_PURCHASE" documentId={id} />
      )}
      {activeTab === 'comments' && <CommentsPanel documentType="LOCAL_PURCHASE" documentId={id} />}
      {activeTab === 'history' && (
        <ApprovalTimeline documentType="LOCAL_PURCHASE" documentId={id} />
      )}

      {activeTab === 'emails' && (
        <section className="card overflow-x-auto">
          {emailLogsLoading ? (
            <p className="text-sm text-muted-foreground">{common.loading}</p>
          ) : emailLogsError ? (
            <p className="text-sm text-red-600">{emailLogsError}</p>
          ) : emailLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{detail.noEmailLogs}</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="pb-2 pr-4">{detail.emailEvent || 'Event'}</th>
                  <th className="pb-2 pr-4">{detail.emailTo}</th>
                  <th className="pb-2 pr-4">{detail.emailSubject}</th>
                  <th className="pb-2 pr-4">{detail.emailStatus}</th>
                  <th className="pb-2">{detail.emailSent}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {emailLogs.map((e) => (
                  <tr key={e.id}>
                    <td className="py-2 pr-4">{e.eventKey || '—'}</td>
                    <td className="py-2 pr-4">{e.to}</td>
                    <td className="py-2 pr-4">{e.subject}</td>
                    <td className="py-2 pr-4">{e.emailStatus}</td>
                    <td className="py-2">
                      {e.sentAt ? new Date(e.sentAt).toLocaleString() : '—'}
                      {e.errorMessage ? (
                        <span className="mt-1 block text-xs text-red-600">{e.errorMessage}</span>
                      ) : null}
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
