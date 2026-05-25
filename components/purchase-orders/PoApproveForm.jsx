'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/apiClient';
import {
  uploadDocumentAttachments,
  formatAttachmentUploadWarning,
} from '@/lib/attachmentUploadHelpers';
import { ALLOWED_MIME_TYPES_CLIENT } from '@/lib/attachmentClientConstants';
import { AnimatedSkeletonLoader } from '@/components/ui';

export default function PoApproveForm({ id }) {
  const router = useRouter();
  const [po, setPo] = useState(null);
  const [comment, setComment] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { json } = await apiFetch(`/api/purchase-orders/${id}`);
      if (json.success) setPo(json.data);
      else setError(json.message || 'Failed to load');
      setLoading(false);
    })();
  }, [id]);

  async function handleApprove() {
    if (!po?.canApproveCurrentStep) {
      setError('You do not have permission to approve at the current step.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { json } = await apiFetch(`/api/purchase-orders/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ comment, __v: po.__v }),
      });
      if (!json.success) {
        setError(json.message || 'Approve failed');
        setSaving(false);
        return;
      }

      if (files.length) {
        const { failures } = await uploadDocumentAttachments({
          documentType: 'PO',
          documentId: id,
          files,
          approvalStep: String(po.currentApprovalStep),
        });
        if (failures.length) {
          const warn = formatAttachmentUploadWarning(failures, 'PO');
          router.push(`/purchase-orders/${id}?attachmentWarning=${encodeURIComponent(warn)}`);
          setSaving(false);
          return;
        }
      }

      router.push(`/purchase-orders/${id}`);
    } catch (err) {
      setError(err.message || 'Approve failed');
    }
    setSaving(false);
  }

  async function handleReject() {
    if (!po?.canApproveCurrentStep) {
      setError('You do not have permission to reject at the current step.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { json } = await apiFetch(`/api/purchase-orders/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ comment, __v: po.__v }),
      });
      if (!json.success) {
        setError(json.message || 'Reject failed');
        setSaving(false);
        return;
      }

      if (files.length) {
        const { failures } = await uploadDocumentAttachments({
          documentType: 'PO',
          documentId: id,
          files,
          approvalStep: String(po.currentApprovalStep),
        });
        if (failures.length) {
          const warn = formatAttachmentUploadWarning(failures, 'PO');
          router.push(`/purchase-orders/${id}?attachmentWarning=${encodeURIComponent(warn)}`);
          setSaving(false);
          return;
        }
      }

      router.push(`/purchase-orders/${id}`);
    } catch (err) {
      setError(err.message || 'Reject failed');
    }
    setSaving(false);
  }

  if (loading) return <AnimatedSkeletonLoader rows={4} />;
  if (!po) return <p className="text-red-600">{error || 'Not found'}</p>;

  const canAct = po.canApproveCurrentStep === true;
  const currentStep = po.workflowSteps?.find((s) => s.state === 'current');
  const waitingLabel = currentStep?.stepName
    ? `Waiting for ${currentStep.stepName} Approval`
    : 'Waiting for approval';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <p className="text-sm text-slate-500">
        <Link href={`/purchase-orders/${id}`} className="text-brand-600 hover:underline">
          {po.portalPONumber}
        </Link>
      </p>
      <h1 className="text-2xl font-semibold">Approve or reject PO</h1>
      <p className="text-sm text-slate-600">
        Status: <strong>{po.status}</strong> · Step {po.currentApprovalStep}
        {po.currentStepName && (
          <span className="ml-2 text-slate-500">({po.currentStepName})</span>
        )}
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!canAct ? (
        <div className="card">
          <p className="text-sm text-slate-700">{waitingLabel}</p>
          <Link href={`/purchase-orders/${id}`} className="btn-secondary mt-4 inline-block">
            Back to PO
          </Link>
        </div>
      ) : (
        <div className="card space-y-4">
          <label className="block text-sm">
            <span className="text-slate-600">Comment</span>
            <textarea
              className="input-field mt-1 min-h-[100px]"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Attachments (optional)</span>
            <input
              type="file"
              multiple
              accept={ALLOWED_MIME_TYPES_CLIENT.join(',')}
              className="mt-1 text-sm"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
            <p className="mt-1 text-xs text-slate-500">
              Files are uploaded after your approval action completes.
            </p>
          </label>
          <div className="flex gap-3">
            <button type="button" className="btn-primary" disabled={saving} onClick={handleApprove}>
              Approve
            </button>
            <button type="button" className="btn-secondary" disabled={saving} onClick={handleReject}>
              Reject
            </button>
            <Link href={`/purchase-orders/${id}`} className="btn-secondary">
              Cancel
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
