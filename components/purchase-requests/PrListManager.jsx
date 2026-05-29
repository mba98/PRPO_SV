'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/apiClient';
import { navigateWithQuery } from '@/lib/listUrl';
import { useAuthStore } from '@/stores/authStore';
import { AnimatedSkeletonLoader, AnimatedStatusBadge } from '@/components/ui';
import { PR_STATUSES } from '@/lib/prPermissions';
import ListPagination from '@/components/lists/ListPagination';
import ApprovalHistoryDrawer from '@/components/approval-history/ApprovalHistoryDrawer';

const TABS = [
  { id: 'my', label: 'My PRs' },
  { id: 'pending', label: 'Pending My Approval' },
  { id: 'approved', label: 'Post-approval' },
  { id: 'failed-sap', label: 'Failed SAP' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'sap', label: 'Created in SAP' },
  { id: 'all', label: 'All', perm: 'view.all' },
];

const EMPTY_FILTERS = {
  q: '',
  portalPRNumber: '',
  sapPRDocNum: '',
  department: '',
  project: '',
  warehouse: '',
  status: '',
  from: '',
  to: '',
};

export default function PrListManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const hasAnyPermission = useAuthStore((s) => s.hasAnyPermission);

  const tab = searchParams.get('tab') || 'my';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const sort = searchParams.get('sort') || 'createdAt';
  const order = searchParams.get('order') || 'desc';

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [historyRow, setHistoryRow] = useState(null);
  const [filters, setFilters] = useState({
    ...EMPTY_FILTERS,
    q: searchParams.get('q') || '',
    portalPRNumber: searchParams.get('portalPRNumber') || '',
    sapPRDocNum: searchParams.get('sapPRDocNum') || '',
    department: searchParams.get('department') || '',
    project: searchParams.get('project') || '',
    warehouse: searchParams.get('warehouse') || '',
    status: searchParams.get('status') || '',
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || '',
  });

  const buildQueryParams = useCallback(
    (overrides = {}) => {
      const params = new URLSearchParams({
        tab: overrides.tab ?? tab,
        page: String(overrides.page ?? page),
        limit: '25',
        sort: overrides.sort ?? sort,
        order: overrides.order ?? order,
      });
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });
      return params;
    },
    [tab, page, sort, order, filters],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = buildQueryParams();
    const { json } = await apiFetch(`/api/purchase-requests?${params}`);
    if (json.success) {
      setItems(json.data);
      setPagination(json.pagination);
    } else {
      setError(json.message || 'Failed to load');
    }
    setLoading(false);
  }, [buildQueryParams]);

  useEffect(() => {
    load();
  }, [load]);

  function pushParams(overrides = {}) {
    navigateWithQuery(router, '/purchase-requests', buildQueryParams(overrides));
  }

  function setTab(next) {
    pushParams({ tab: next, page: 1 });
  }

  function applyFilters(e) {
    e.preventDefault();
    pushParams({ page: 1 });
  }

  function resetFilters() {
    setFilters({ ...EMPTY_FILTERS });
    navigateWithQuery(router, '/purchase-requests', new URLSearchParams({ tab }));
  }

  function toggleSort(field) {
    const nextOrder = sort === field && order === 'desc' ? 'asc' : 'desc';
    pushParams({ sort: field, order: nextOrder, page: 1 });
  }

  async function exportExcel() {
    const params = buildQueryParams({ page: 1 });
    params.set('limit', '5000');
    window.open(`/api/export/purchase-requests?${params}`, '_blank');
  }

  const visibleTabs = TABS.filter((t) => {
    if (t.id === 'pending') {
      return hasAnyPermission(['pr.approve.whs', 'pr.approve.pm', 'view.all']);
    }
    if (t.id === 'approved') {
      return (
        hasPermission('pr.create') ||
        hasAnyPermission(['pr.approve.whs', 'pr.approve.pm', 'view.all', 'admin.settings'])
      );
    }
    if (t.id === 'failed-sap') {
      return hasAnyPermission(['view.all', 'admin.settings']);
    }
    if (t.perm) return hasPermission(t.perm);
    return true;
  });

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
        <div className="flex flex-wrap gap-2">
          {hasAnyPermission(['po.create', 'view.all']) && (
            <Link href="/purchase-requests/approved-for-po" className="btn-secondary">
              PRs ready for PO
            </Link>
          )}
          <button type="button" onClick={exportExcel} className="btn-secondary">
            Export Excel
          </button>
          {hasPermission('pr.create') && (
            <Link href="/purchase-requests/create" className="btn-primary">
              New Purchase Request
            </Link>
          )}
        </div>
      </div>

      <form onSubmit={applyFilters} className="card space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm sm:col-span-2">
            <span className="text-slate-600">Search</span>
            <input
              className="input-field mt-1"
              placeholder="PR #, SAP #, department, project…"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            />
          </label>
          {[
            ['portalPRNumber', 'Portal PR #'],
            ['sapPRDocNum', 'SAP PR Doc #'],
            ['department', 'Department'],
            ['project', 'Project'],
            ['warehouse', 'Warehouse'],
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
          <label className="text-sm">
            <span className="text-slate-600">Status</span>
            <select
              className="input-field mt-1"
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">All statuses</option>
              {PR_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn-secondary">
            Apply filters
          </button>
          <button type="button" onClick={resetFilters} className="rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
            Reset
          </button>
        </div>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <AnimatedSkeletonLoader rows={6} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">
                    <button type="button" onClick={() => toggleSort('portalPRNumber')}>
                      PR Number
                    </button>
                  </th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">SAP Doc</th>
                  <th className="px-4 py-3">
                    <button type="button" onClick={() => toggleSort('createdAt')}>
                      Created
                    </button>
                  </th>
                  <th className="px-4 py-3">Actions</th>
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
                    <td className="px-4 py-3">
                      <AnimatedStatusBadge status={pr.status} />
                    </td>
                    <td className="px-4 py-3">{pr.sapPRDocNum || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {pr.createdAt ? new Date(pr.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="text-sm font-medium text-brand-600 hover:underline"
                        onClick={() => setHistoryRow(pr)}
                      >
                        History
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ListPagination pagination={pagination} page={page} onPageChange={(p) => pushParams({ page: p })} />
        </>
      )}

      <ApprovalHistoryDrawer
        isOpen={Boolean(historyRow)}
        onClose={() => setHistoryRow(null)}
        documentType="PR"
        documentId={historyRow?.id}
        documentNumber={historyRow?.portalPRNumber}
      />
    </div>
  );
}
