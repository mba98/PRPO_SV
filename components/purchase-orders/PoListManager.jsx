'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { AnimatedSkeletonLoader, AnimatedStatusBadge } from '@/components/ui';

const TABS = [
  { id: 'pending', label: 'Pending My Approval' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'sap', label: 'Created in SAP' },
  { id: 'all', label: 'All', perm: 'view.all' },
];

export default function PoListManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const tab = searchParams.get('tab') || 'pending';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    portalPONumber: searchParams.get('portalPONumber') || '',
    relatedPRNumber: searchParams.get('relatedPRNumber') || '',
    vendor: searchParams.get('vendor') || '',
    status: searchParams.get('status') || '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ tab, limit: '50' });
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    const { json } = await apiFetch(`/api/purchase-orders?${params}`);
    if (json.success) setItems(json.data);
    else setError(json.message || 'Failed to load');
    setLoading(false);
  }, [tab, filters]);

  useEffect(() => {
    load();
  }, [load]);

  function setTab(next) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', next);
    router.push(`/purchase-orders?${params}`);
  }

  const visibleTabs = TABS.filter((t) => !t.perm || hasPermission(t.perm));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === t.id ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form
        className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        {[
          ['portalPONumber', 'PO Number'],
          ['relatedPRNumber', 'PR Number'],
          ['vendor', 'Vendor'],
          ['status', 'Status'],
        ].map(([key, label]) => (
          <label key={key} className="text-sm">
            <span className="text-slate-600">{label}</span>
            <input
              className="input-field mt-1"
              value={filters[key]}
              onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}
            />
          </label>
        ))}
        <div className="flex items-end">
          <button type="submit" className="btn-secondary">
            Apply
          </button>
        </div>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <AnimatedSkeletonLoader rows={6} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">PO Number</th>
                <th className="px-4 py-3">PR Number</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">SAP PO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No purchase orders
                  </td>
                </tr>
              )}
              {items.map((po) => (
                <tr key={po.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/purchase-orders/${po.id}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {po.portalPONumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {po.relatedPRId ? (
                      <Link
                        href={`/purchase-requests/${po.relatedPRId}`}
                        className="text-brand-600 hover:underline"
                      >
                        {po.relatedPRNumber}
                      </Link>
                    ) : (
                      po.relatedPRNumber
                    )}
                  </td>
                  <td className="px-4 py-3">{po.vendor}</td>
                  <td className="px-4 py-3">
                    <AnimatedStatusBadge status={po.status} />
                  </td>
                  <td className="px-4 py-3">{po.sapPODocNum || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
