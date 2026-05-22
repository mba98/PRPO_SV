'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { AnimatedSkeletonLoader, AnimatedStatusBadge } from '@/components/ui';
import WorkflowStepper from '@/components/workflow/WorkflowStepper';

export default function PrDetailView({ id }) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [pr, setPr] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('details');

  const load = useCallback(async () => {
    setLoading(true);
    const [{ json: prJson }, { json: cJson }] = await Promise.all([
      apiFetch(`/api/purchase-requests/${id}`),
      apiFetch(`/api/purchase-requests/${id}/comments`),
    ]);
    if (prJson.success) setPr(prJson.data);
    else setError(prJson.message || 'Failed to load');
    if (cJson.success) setComments(cJson.data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function postComment(e) {
    e.preventDefault();
    const { json } = await apiFetch(`/api/purchase-requests/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ comment: commentText }),
    });
    if (json.success) {
      setCommentText('');
      load();
    }
  }

  async function retrySap() {
    const { json } = await apiFetch(`/api/purchase-requests/${id}/retry-sap`, { method: 'POST' });
    if (json.success) load();
    else setError(json.message || 'Retry failed');
  }

  if (loading) return <AnimatedSkeletonLoader rows={8} />;
  if (!pr) return <p className="text-red-600">{error || 'Not found'}</p>;

  const canApprove = pr.canApproveCurrentStep === true;
  const canRetrySap = pr.canRetrySap === true;
  const showRetryDeniedNote = pr.status === 'Failed to Create in SAP' && !canRetrySap;

  const tabs = ['details', 'attachments', 'comments', 'history'];

  return (
    <div className="space-y-6">
      {pr.workflowSteps?.length > 0 && <WorkflowStepper steps={pr.workflowSteps} />}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            <Link href="/purchase-requests" className="text-brand-600 hover:underline">
              Purchase Requests
            </Link>
            {' / '}
            {pr.portalPRNumber}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">{pr.portalPRNumber}</h1>
          <div className="mt-2">
            <AnimatedStatusBadge status={pr.status} />
          </div>
        </div>
        <div className="flex gap-2">
          {canApprove && (
            <Link href={`/purchase-requests/${id}/approve`} className="btn-primary">
              Approve / Reject
            </Link>
          )}
          {canRetrySap && (
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
              ['Department', pr.department],
              ['Project', pr.project],
              ['Warehouse', pr.warehouse],
              ['Required date', pr.requiredDate ? new Date(pr.requiredDate).toLocaleDateString() : '—'],
              ['Requester', pr.requesterName || pr.requesterEmail],
              ['SAP requester code', pr.requesterSapRequesterCode || '—'],
              ['SAP PR', pr.sapPRDocNum || '—'],
            ].map(([label, val]) => (
              <div key={label}>
                <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
                <p className="mt-1 text-sm text-slate-900">{val || '—'}</p>
              </div>
            ))}
            {pr.remarks && (
              <div className="sm:col-span-2 lg:col-span-3">
                <p className="text-xs font-medium uppercase text-slate-500">Remarks</p>
                <p className="mt-1 text-sm text-slate-900">{pr.remarks}</p>
              </div>
            )}
            {pr.status === 'Failed to Create in SAP' && (
              <div className="sm:col-span-2 lg:col-span-3 rounded-md border border-rose-200 bg-rose-50 px-4 py-3">
                <p className="text-xs font-medium uppercase text-rose-700">SAP creation failed</p>
                {pr.sapErrorMessage && (
                  <p className="mt-1 text-sm text-rose-800">{pr.sapErrorMessage}</p>
                )}
                {pr.sapReferenceSummary && (
                  <p className="mt-2 text-xs text-rose-900/90 font-mono break-all">
                    {pr.sapReferenceSummary}
                  </p>
                )}
                {pr.requesterMissingSapCode && (
                  <p className="mt-2 text-sm text-rose-800">
                    Original requester is missing SAP requester code.
                  </p>
                )}
                {showRetryDeniedNote && (
                  <p className="mt-2 text-sm text-slate-600">
                    SAP retry is available to Admin users only.
                  </p>
                )}
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
                  <th className="pb-2 pr-4">UoM</th>
                  <th className="pb-2 pr-4">Unit price</th>
                  <th className="pb-2">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(pr.lines || []).map((line, i) => (
                  <tr key={line._id || i}>
                    <td className="py-2 pr-4">
                      <span className="font-medium">{line.itemCode}</span>
                      <span className="ml-2 text-slate-600">{line.itemName}</span>
                    </td>
                    <td className="py-2 pr-4">{line.quantity}</td>
                    <td className="py-2 pr-4">{line.uom}</td>
                    <td className="py-2 pr-4">{line.estimatedUnitPrice ?? '—'}</td>
                    <td className="py-2">{line.estimatedTotal ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      {activeTab === 'attachments' && (
        <section className="card">
          {(pr.attachments || []).length === 0 ? (
            <p className="text-sm text-slate-500">No files attached</p>
          ) : (
            <ul className="space-y-2">
              {pr.attachments.map((a) => (
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

      {activeTab === 'comments' && (
        <section className="card space-y-4">
          <form onSubmit={postComment} className="flex gap-2">
            <input
              className="input-field flex-1"
              placeholder="Add a comment"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              required
            />
            <button type="submit" className="btn-primary">
              Post
            </button>
          </form>
          <ul className="space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="rounded-md border border-slate-100 px-3 py-2">
                <p className="text-sm text-slate-900">{c.comment}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {c.postedBy} · {new Date(c.postedAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {activeTab === 'history' && (
        <section className="card">
          <ol className="relative border-l border-slate-200 pl-6">
            {(pr.approvalHistory || []).map((h) => (
              <li key={h.id} className="mb-6 ml-2">
                <span className="absolute -left-[9px] mt-1.5 h-4 w-4 rounded-full border-2 border-white bg-brand-500 ring-2 ring-brand-100" />
                <p className="text-sm font-medium text-slate-900">
                  {h.action} — {h.stepName}
                </p>
                <p className="text-xs text-slate-500">
                  {h.actionBy} · {new Date(h.actionDate).toLocaleString()}
                </p>
                {h.comment && <p className="mt-1 text-sm text-slate-600">{h.comment}</p>}
                <p className="mt-1 text-xs text-slate-400">
                  {h.previousStatus} → {h.newStatus}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
