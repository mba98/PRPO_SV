'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { AnimatedSkeletonLoader, AnimatedStatusBadge } from '@/components/ui';
import ListPagination from '@/components/lists/ListPagination';
import ApprovalHistoryDrawer from '@/components/approval-history/ApprovalHistoryDrawer';

const TABS = [
  { id: 'pending', label: 'Pending My Approval' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'sap', label: 'Created in SAP' },
  { id: 'all', label: 'All', perm: 'view.all' },
];

const EMPTY_FILTERS = {
  q: '',
  portalPONumber: '',
  relatedPRNumber: '',
  sapPODocNum: '',
  vendor: '',
  department: '',
  project: '',
  warehouse: '',
  status: '',
  from: '',
  to: '',
};

export default function PoListManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const hasAnyPermission = useAuthStore((s) => s.hasAnyPermission);

  const defaultTab = hasAnyPermission(['po.approve.pm', 'po.approve.finance', 'view.all'])
    ? 'pending'
    : 'approved';
  const tab = searchParams.get('tab') || defaultTab;
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
    portalPONumber: searchParams.get('portalPONumber') || '',
    relatedPRNumber: searchParams.get('relatedPRNumber') || '',
    sapPODocNum: searchParams.get('sapPODocNum') || '',
    vendor: searchParams.get('vendor') || '',
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
    const { json } = await apiFetch(`/api/purchase-orders?${buildQueryParams()}`);
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
    router.push(`/purchase-orders?${buildQueryParams(overrides)}`);
  }

  function exportExcel() {
    const params = buildQueryParams({ page: 1 });
    params.set('limit', '5000');
    window.open(`/api/export/purchase-orders?${params}`, '_blank');
  }

  const visibleTabs = TABS.filter((t) => {
    if (t.perm) return hasPermission(t.perm);
    if (t.id === 'pending') {
      return hasAnyPermission(['po.approve.pm', 'po.approve.finance', 'view.all', 'po.create']);
    }
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
              onClick={() => pushParams({ tab: t.id, page: 1 })}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                tab === t.id ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={exportExcel} className="btn-secondary">
          Export Excel
        </button>
      </div>

      <form
        className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          pushParams({ page: 1 });
        }}
      >
        <label className="text-sm sm:col-span-2">
          <span className="text-slate-600">Search</span>
          <input
            className="input-field mt-1"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />
        </label>
        {[
          ['portalPONumber', 'PO Number'],
          ['relatedPRNumber', 'PR Number'],
          ['sapPODocNum', 'SAP PO #'],
          ['vendor', 'Vendor'],
          ['status', 'Status'],
          ['from', 'From'],
          ['to', 'To'],
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
        <div className="flex items-end gap-2">
          <button type="submit" className="btn-secondary">
            Apply
          </button>
          <button
            type="button"
            className="text-sm text-slate-600"
            onClick={() => {
              setFilters({ ...EMPTY_FILTERS });
              router.push(`/purchase-orders?tab=${tab}`);
            }}
          >
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
                  <th className="px-4 py-3">PO Number</th>
                  <th className="px-4 py-3">PR Number</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">SAP PO</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No purchase orders
                    </td>
                  </tr>
                )}
                {items.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/purchase-orders/${po.id}`} className="font-medium text-brand-600 hover:underline">
                        {po.portalPONumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{po.relatedPRNumber || '—'}</td>
                    <td className="px-4 py-3">{po.vendor}</td>
                    <td className="px-4 py-3">
                      <AnimatedStatusBadge status={po.status} />
                    </td>
                    <td className="px-4 py-3">{po.sapPODocNum || '—'}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="text-sm font-medium text-brand-600 hover:underline"
                        onClick={() => setHistoryRow(po)}
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
        documentType="PO"
        documentId={historyRow?.id}
        documentNumber={historyRow?.portalPONumber}
      />
    </div>
  );
}
