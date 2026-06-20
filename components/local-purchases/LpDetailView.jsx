'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/apiClient';
import { usePortalDocument } from '@/lib/hooks/usePortalDocument';
import { PortalLoader, AnimatedStatusBadge, Button } from '@/components/ui';
import { WorkflowStepper } from '@/components/workflow';
import AttachmentPanel from '@/components/attachments/AttachmentPanel';
import CommentsPanel from '@/components/comments/CommentsPanel';
import ApprovalTimeline from '@/components/approval-history/ApprovalTimeline';
import { useI18n } from '@/lib/hooks/useI18n';

export default function LpDetailView({ id }) {
  const router = useRouter();
  const { common, detail, lp: lpI18n } = useI18n();
  const { doc, loading, error, refresh } = usePortalDocument('LOCAL_PURCHASE', id, 'LpDetailView');
  const [activeTab, setActiveTab] = useState('details');
  const [actionError, setActionError] = useState('');
  const [acting, setActing] = useState(false);

  if (loading) return <PortalLoader />;
  if (error || !doc) return <p className="text-sm text-red-600">{error || common.errorLoad}</p>;

  const tabs = [
    { id: 'details', label: common.details },
    { id: 'attachments', label: common.attachments },
    { id: 'comments', label: common.comments },
    { id: 'history', label: common.approvalHistory },
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
    await refresh();
  }

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
              <dt className="text-sm text-muted-foreground">{common.documentDate}</dt>
              <dd>{doc.documentDate ? new Date(doc.documentDate).toLocaleDateString() : '—'}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">{lpI18n.requiredDate}</dt>
              <dd>{doc.requiredDate ? new Date(doc.requiredDate).toLocaleDateString() : '—'}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">{common.project}</dt>
              <dd>
                {doc.projectCode}
                {doc.projectName ? ` — ${doc.projectName}` : ''}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">{lpI18n.vendorName}</dt>
              <dd>{doc.vendorName}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">{lpI18n.vendorReference}</dt>
              <dd>{doc.vendorReference || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">{lpI18n.currency}</dt>
              <dd>
                {doc.currency} ({lpI18n.exchangeRate}: {doc.exchangeRate})
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm text-muted-foreground">{detail.remarks}</dt>
              <dd>{doc.remarks || '—'}</dd>
            </div>
          </dl>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{lpI18n.lineDescription}</th>
                  <th>{lpI18n.uom}</th>
                  <th>{lpI18n.quantity}</th>
                  <th>{lpI18n.unitPrice}</th>
                  <th>{common.total}</th>
                  <th>{lpI18n.notes}</th>
                </tr>
              </thead>
              <tbody>
                {(doc.lines || []).map((line) => (
                  <tr key={line._id}>
                    <td>{line.description}</td>
                    <td>{line.uom || '—'}</td>
                    <td>{line.quantity}</td>
                    <td>{Number(line.unitPrice).toFixed(2)}</td>
                    <td>{Number(line.lineTotal).toFixed(2)}</td>
                    <td>{line.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-right font-semibold">
            {common.total}: {Number(doc.documentTotal || 0).toFixed(2)} {doc.currency}
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
    </div>
  );
}
