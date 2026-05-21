'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/apiClient';
import { AnimatedSkeletonLoader } from '@/components/ui';

export default function PoApproveForm({ id }) {
  const router = useRouter();
  const [po, setPo] = useState(null);
  const [comment, setComment] = useState('');
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
    setSaving(true);
    setError('');
    const { json } = await apiFetch(`/api/purchase-orders/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ comment, __v: po.__v }),
    });
    if (json.success) router.push(`/purchase-orders/${id}`);
    else setError(json.message || 'Approve failed');
    setSaving(false);
  }

  async function handleReject() {
    setSaving(true);
    setError('');
    const { json } = await apiFetch(`/api/purchase-orders/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ comment, __v: po.__v }),
    });
    if (json.success) router.push(`/purchase-orders/${id}`);
    else setError(json.message || 'Reject failed');
    setSaving(false);
  }

  if (loading) return <AnimatedSkeletonLoader rows={4} />;
  if (!po) return <p className="text-red-600">{error || 'Not found'}</p>;

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
    </div>
  );
}
