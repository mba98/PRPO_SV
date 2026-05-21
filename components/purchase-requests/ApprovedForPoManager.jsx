'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/apiClient';
import { AnimatedSkeletonLoader, AnimatedStatusBadge } from '@/components/ui';

export default function ApprovedForPoManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [vendor, setVendor] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const selected = items.find((pr) => pr.id === selectedId);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { json } = await apiFetch('/api/purchase-requests/approved-for-po?limit=100');
    if (json.success) {
      setItems(json.data);
      setSelectedId((prev) => prev || json.data[0]?.id || '');
    } else {
      setError(json.message || 'Failed to load');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    const defaultVendor =
      selected.pendingVendors?.[0] ||
      selected.suggestedVendors?.[0] ||
      '';
    setVendor(defaultVendor);
  }, [selectedId, selected]);

  async function handleCreatePo(retry = false) {
    if (!selectedId || !vendor.trim()) {
      setError('Select a PR and enter a vendor code');
      return;
    }
    setSubmitting(true);
    setError('');
    setMessage('');
    const path = retry
      ? `/api/purchase-orders/from-pr/${selectedId}/retry`
      : `/api/purchase-orders/from-pr/${selectedId}`;
    const { json } = await apiFetch(path, {
      method: 'POST',
      body: JSON.stringify({ vendor: vendor.trim() }),
    });
    if (json.success) {
      setMessage(
        `PO created: ${json.data.po?.portalPONumber} (SAP ${json.data.po?.sapPODocNum || '—'})`,
      );
      setSelectedId('');
      await load();
    } else {
      setError(json.message || 'PO creation failed');
    }
    setSubmitting(false);
  }

  const canRetry =
    selected?.sapPOCreationStatus === 'Failed' || selected?.existingPOs?.some(
      (o) => o.status === 'Failed to Create in SAP',
    );

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
          {message}
        </p>
      )}

      {loading ? (
        <AnimatedSkeletonLoader rows={5} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 w-10" />
                  <th className="px-4 py-3">PR Number</th>
                  <th className="px-4 py-3">SAP PR</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">SAP PO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No PRs ready for PO creation
                    </td>
                  </tr>
                )}
                {items.map((pr) => (
                  <tr
                    key={pr.id}
                    className={`cursor-pointer hover:bg-slate-50 ${selectedId === pr.id ? 'bg-brand-50' : ''}`}
                    onClick={() => setSelectedId(pr.id)}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="radio"
                        name="pr-select"
                        checked={selectedId === pr.id}
                        onChange={() => setSelectedId(pr.id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/purchase-requests/${pr.id}`}
                        className="font-medium text-brand-600 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {pr.portalPRNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{pr.sapPRDocNum || pr.sapPRDocEntry}</td>
                    <td className="px-4 py-3">{pr.department}</td>
                    <td className="px-4 py-3">
                      <AnimatedStatusBadge status={pr.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {pr.sapPODocNum || '—'}
                      {pr.pendingVendors?.length > 0 && (
                        <span className="ml-1 text-xs text-amber-700">
                          ({pr.pendingVendors.length} vendor
                          {pr.pendingVendors.length > 1 ? 's' : ''} pending)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Create SAP Purchase Order</h2>
            {!selected ? (
              <p className="text-sm text-slate-500">Select a purchase request from the list.</p>
            ) : (
              <>
                <p className="text-sm text-slate-600">
                  PR <strong>{selected.portalPRNumber}</strong> · SAP PR{' '}
                  <strong>{selected.sapPRDocNum}</strong>
                </p>
                {selected.suggestedVendors?.length > 0 && (
                  <p className="text-xs text-slate-500">
                    Suggested vendors: {selected.suggestedVendors.join(', ')}
                  </p>
                )}
                {selected.existingPOs?.length > 0 && (
                  <ul className="text-xs text-slate-500">
                    {selected.existingPOs.map((o) => (
                      <li key={o.id}>
                        {o.portalPONumber} — {o.vendor} ({o.status})
                      </li>
                    ))}
                  </ul>
                )}
                <label className="block text-sm">
                  <span className="text-slate-600">Vendor (SAP CardCode)</span>
                  <input
                    className="input-field mt-1"
                    value={vendor}
                    list="vendor-suggestions"
                    placeholder="e.g. V10000"
                    onChange={(e) => setVendor(e.target.value)}
                  />
                  <datalist id="vendor-suggestions">
                    {(selected.pendingVendors || selected.suggestedVendors || []).map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                </label>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={submitting || !vendor.trim()}
                    onClick={() => handleCreatePo(false)}
                  >
                    {submitting ? 'Creating PO in SAP…' : 'Create PO in SAP'}
                  </button>
                  {canRetry && (
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={submitting || !vendor.trim()}
                      onClick={() => handleCreatePo(true)}
                    >
                      Retry failed PO
                    </button>
                  )}
                </div>
                {selected.sapPOErrorMessage && (
                  <p className="text-xs text-red-600">Last error: {selected.sapPOErrorMessage}</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
