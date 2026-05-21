'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/apiClient';
import { AnimatedSkeletonLoader, AnimatedStatusBadge } from '@/components/ui';

const STATUS_OPTIONS = [
  '',
  'Creating in SAP',
  'Created in SAP',
  'Failed to Create in SAP',
  'Completed',
];

export default function ApriListManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    portalAPNumber: searchParams.get('portalAPNumber') || '',
    relatedPONumber: searchParams.get('relatedPONumber') || '',
    vendor: searchParams.get('vendor') || '',
    status: searchParams.get('status') || '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ limit: '50' });
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    const { json } = await apiFetch(`/api/ap-reserve-invoices?${params}`);
    if (json.success) setItems(json.data);
    else setError(json.message || 'Failed to load');
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  function applyFilters(e) {
    e.preventDefault();
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    router.push(`/ap-reserve-invoices?${params}`);
    load();
  }

  return (
    <div className="space-y-6">
      <form className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={applyFilters}>
        <label className="block text-sm">
          <span className="text-xs font-medium text-slate-500">AP Number</span>
          <input
            className="input mt-1 w-full"
            value={filters.portalAPNumber}
            onChange={(e) => setFilters((f) => ({ ...f, portalAPNumber: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-medium text-slate-500">PO Number</span>
          <input
            className="input mt-1 w-full"
            value={filters.relatedPONumber}
            onChange={(e) => setFilters((f) => ({ ...f, relatedPONumber: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-medium text-slate-500">Vendor</span>
          <input
            className="input mt-1 w-full"
            value={filters.vendor}
            onChange={(e) => setFilters((f) => ({ ...f, vendor: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-medium text-slate-500">Status</span>
          <select
            className="input mt-1 w-full"
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s || 'all'} value={s}>
                {s || 'All statuses'}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end sm:col-span-2 lg:col-span-4">
          <button type="submit" className="btn-primary">
            Apply filters
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
                <th className="px-4 py-3">AP Number</th>
                <th className="px-4 py-3">PO Number</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">SAP AP</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No A/P Reserve Invoices found
                  </td>
                </tr>
              )}
              {items.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/ap-reserve-invoices/${row.id}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {row.portalAPNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{row.relatedPONumber}</td>
                  <td className="px-4 py-3">{row.vendor}</td>
                  <td className="px-4 py-3">{row.sapAPDocNum || '—'}</td>
                  <td className="px-4 py-3">
                    <AnimatedStatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
