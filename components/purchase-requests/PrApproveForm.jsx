'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/apiClient';
import { uploadAttachmentFile } from '@/lib/uploadClient';
import { AnimatedSkeletonLoader } from '@/components/ui';

export default function PrApproveForm({ id }) {
  const router = useRouter();
  const [pr, setPr] = useState(null);
  const [comment, setComment] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { json } = await apiFetch(`/api/purchase-requests/${id}`);
      if (json.success) setPr(json.data);
      else setError(json.message || 'Failed to load');
      setLoading(false);
    })();
  }, [id]);

  async function uploadFiles() {
    for (const file of files) {
      await uploadAttachmentFile({
        documentType: 'PR',
        documentId: id,
        file,
        approvalStep: String(pr.currentApprovalStep),
      });
    }
  }

  async function handleApprove() {
    setSaving(true);
    setError('');
    try {
      if (files.length) await uploadFiles();
      const { json } = await apiFetch(`/api/purchase-requests/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ comment, __v: pr.__v }),
      });
      if (json.success) {
        router.push(`/purchase-requests/${id}`);
      } else {
        setError(json.message || 'Approve failed');
      }
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  async function handleReject() {
    setSaving(true);
    setError('');
    try {
      if (files.length) await uploadFiles();
      const { json } = await apiFetch(`/api/purchase-requests/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ comment, __v: pr.__v }),
      });
      if (json.success) {
        router.push(`/purchase-requests/${id}`);
      } else {
        setError(json.message || 'Reject failed');
      }
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  if (loading) return <AnimatedSkeletonLoader rows={4} />;
  if (!pr) return <p className="text-red-600">{error || 'Not found'}</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <p className="text-sm text-slate-500">
        <Link href={`/purchase-requests/${id}`} className="text-brand-600 hover:underline">
          {pr.portalPRNumber}
        </Link>
      </p>
      <h1 className="text-2xl font-semibold">Approve or reject</h1>
      <p className="text-sm text-slate-600">
        Status: <strong>{pr.status}</strong> · Step {pr.currentApprovalStep}
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

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
            className="mt-1 text-sm"
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
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
    </div>
  );
}
