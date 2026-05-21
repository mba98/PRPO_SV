'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { AnimatedSkeletonLoader, AnimatedStatusBadge } from '@/components/ui';

const TABS = [
  { id: 'my', label: 'My PRs' },
  { id: 'pending', label: 'Pending My Approval' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'sap', label: 'Created in SAP' },
  { id: 'all', label: 'All', perm: 'view.all' },
];

export default function PrListManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canCreate = hasPermission('pr.create');

  const tab = searchParams.get('tab') || 'my';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    portalPRNumber: searchParams.get('portalPRNumber') || '',
    sapPRDocNum: searchParams.get('sapPRDocNum') || '',
    department: searchParams.get('department') || '',
    project: searchParams.get('project') || '',
    warehouse: searchParams.get('warehouse') || '',
    status: searchParams.get('status') || '',
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ tab, limit: '50' });
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    const { json } = await apiFetch(`/api/purchase-requests?${params}`);
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
    router.push(`/purchase-requests?${params}`);
  }

  function applyFilters(e) {
    e.preventDefault();
    const params = new URLSearchParams({ tab });
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    router.push(`/purchase-requests?${params}`);
    load();
  }

  const visibleTabs = TABS.filter((t) => !t.perm || hasPermission(t.perm));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t.id ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {canCreate && (
          <Link href="/purchase-requests/create" className="btn-primary">
            New Purchase Request
          </Link>
        )}
      </div>

      <form onSubmit={applyFilters} className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['portalPRNumber', 'Portal PR #'],
          ['sapPRDocNum', 'SAP PR Doc #'],
          ['department', 'Department'],
          ['project', 'Project'],
          ['warehouse', 'Warehouse'],
          ['status', 'Status'],
          ['from', 'From date'],
          ['to', 'To date'],
        ].map(([key, label]) => (
          <label key={key} className="text-sm">
            <span className="text-slate-600">{label}</span>
            <input
              className="input-field mt-1"
              type={key === 'from' || key === 'to' ? 'date' : 'text'}
              value={filters[key]}
              onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}
            />
          </label>
        ))}
        <div className="flex items-end">
          <button type="submit" className="btn-secondary">
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
                <th className="px-4 py-3">PR Number</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">SAP Doc</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No purchase requests found
                  </td>
                </tr>
              )}
              {items.map((pr) => (
                <tr key={pr.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/purchase-requests/${pr.id}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {pr.portalPRNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{pr.department}</td>
                  <td className="px-4 py-3">{pr.project || '—'}</td>
                  <td className="px-4 py-3">
                    <AnimatedStatusBadge status={pr.status} />
                  </td>
                  <td className="px-4 py-3">{pr.sapPRDocNum || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {pr.createdAt ? new Date(pr.createdAt).toLocaleDateString() : '—'}
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
