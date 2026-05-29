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

export default function PrApproveForm({ id }) {
  const router = useRouter();
  const [pr, setPr] = useState(null);
  const [comment, setComment] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  useEffect(() => {
    (async () => {
      const { json } = await apiFetch(`/api/purchase-requests/${id}`);
      if (json.success) setPr(json.data);
      else setError(json.message || 'Failed to load');
      setLoading(false);
    })();
  }, [id]);

  async function handleApprove() {
    if (!pr?.canApproveCurrentStep) {
      setError('You do not have permission to approve at the current step.');
      return;
    }
    setSaving(true);
    setError('');
    setWarning('');
    try {
      const { json } = await apiFetch(`/api/purchase-requests/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ comment, __v: pr.__v }),
      });
      if (!json.success) {
        setError(json.message || 'Approve failed');
        setSaving(false);
        return;
      }

      if (files.length) {
        const { failures } = await uploadDocumentAttachments({
          documentType: 'PR',
          documentId: id,
          files,
          approvalStep: String(pr.currentApprovalStep),
        });
        if (failures.length) {
          const warn = formatAttachmentUploadWarning(failures, 'PR');
          router.push(`/purchase-requests/${id}?attachmentWarning=${encodeURIComponent(warn)}`);
          setSaving(false);
          return;
        }
      }

      router.push(`/purchase-requests/${id}`);
    } catch (err) {
      setError(err.message || 'Approve failed');
    }
    setSaving(false);
  }

  async function handleReject() {
    if (!pr?.canApproveCurrentStep) {
      setError('You do not have permission to reject at the current step.');
      return;
    }
    setSaving(true);
    setError('');
    setWarning('');
    try {
      const { json } = await apiFetch(`/api/purchase-requests/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ comment, __v: pr.__v }),
      });
      if (!json.success) {
        setError(json.message || 'Reject failed');
        setSaving(false);
        return;
      }

      if (files.length) {
        const { failures } = await uploadDocumentAttachments({
          documentType: 'PR',
          documentId: id,
          files,
          approvalStep: String(pr.currentApprovalStep),
        });
        if (failures.length) {
          const warn = formatAttachmentUploadWarning(failures, 'PR');
          router.push(`/purchase-requests/${id}?attachmentWarning=${encodeURIComponent(warn)}`);
          setSaving(false);
          return;
        }
      }

      router.push(`/purchase-requests/${id}`);
    } catch (err) {
      setError(err.message || 'Reject failed');
    }
    setSaving(false);
  }

  if (loading) return <AnimatedSkeletonLoader rows={4} />;
  if (!pr) return <p className="text-red-600">{error || 'Not found'}</p>;

  const canAct = pr.canApproveCurrentStep === true;
  const currentStep = pr.workflowSteps?.find((s) => s.state === 'current');
  const waitingLabel = currentStep?.stepName
    ? `Waiting for ${currentStep.stepName} Approval`
    : 'Waiting for approval';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <p className="text-sm text-muted-foreground">
        <Link href={`/purchase-requests/${id}`} className="text-primary hover:underline">
          {pr.portalPRNumber}
        </Link>
      </p>
      <h1 className="text-2xl font-semibold">Approve or reject</h1>
      <p className="text-sm text-muted-foreground">
        Status: <strong>{pr.status}</strong> · Step {pr.currentApprovalStep}
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {warning && <p className="text-sm text-amber-700">{warning}</p>}

      {!canAct ? (
        <div className="card">
          <p className="text-sm text-foreground">{waitingLabel}</p>
          <Link href={`/purchase-requests/${id}`} className="btn-secondary mt-4 inline-block">
            Back to PR
          </Link>
        </div>
      ) : (
        <div className="card space-y-4">
          <label className="block text-sm">
            <span className="text-muted-foreground">Comment</span>
            <textarea
              className="input-field mt-1 min-h-[100px]"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Attachments (optional)</span>
            <input
              type="file"
              multiple
              accept={ALLOWED_MIME_TYPES_CLIENT.join(',')}
              className="mt-1 text-sm"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
            <p className="mt-1 text-xs text-muted-foreground">
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
            <Link href={`/purchase-requests/${id}`} className="btn-secondary">
              Cancel
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
