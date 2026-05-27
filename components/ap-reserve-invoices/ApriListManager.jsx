'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/apiClient';
import { AnimatedSkeletonLoader, AnimatedStatusBadge } from '@/components/ui';
import ListPagination from '@/components/lists/ListPagination';
import ApprovalHistoryDrawer from '@/components/approval-history/ApprovalHistoryDrawer';

const STATUS_OPTIONS = ['', 'Creating in SAP', 'Created in SAP', 'Failed to Create in SAP'];

const EMPTY_FILTERS = {
  q: '',
  portalAPNumber: '',
  relatedPONumber: '',
  sapAPDocNum: '',
  vendor: '',
  status: '',
  from: '',
  to: '',
};

export default function ApriListManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
    portalAPNumber: searchParams.get('portalAPNumber') || '',
    relatedPONumber: searchParams.get('relatedPONumber') || '',
    sapAPDocNum: searchParams.get('sapAPDocNum') || '',
    vendor: searchParams.get('vendor') || '',
    status: searchParams.get('status') || '',
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || '',
  });

  const buildQueryParams = useCallback(
    (overrides = {}) => {
      const params = new URLSearchParams({
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
    [page, sort, order, filters],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { json } = await apiFetch(`/api/ap-reserve-invoices?${buildQueryParams()}`);
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
    router.push(`/ap-reserve-invoices?${buildQueryParams(overrides)}`);
  }

  function exportExcel() {
    const params = buildQueryParams({ page: 1 });
    params.set('limit', '5000');
    window.open(`/api/export/ap-reserve-invoices?${params}`, '_blank');
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
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
          ['portalAPNumber', 'AP Number'],
          ['relatedPONumber', 'PO Number'],
          ['sapAPDocNum', 'SAP AP #'],
          ['vendor', 'Vendor'],
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
        <label className="text-sm">
          <span className="text-slate-600">Status</span>
          <select
            className="input-field mt-1"
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s || 'all'} value={s}>
                {s || 'All'}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className="btn-secondary">
            Apply
          </button>
          <button
            type="button"
            className="text-sm text-slate-600"
            onClick={() => {
              setFilters({ ...EMPTY_FILTERS });
              router.push('/ap-reserve-invoices');
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
                  <th className="px-4 py-3">AP Number</th>
                  <th className="px-4 py-3">PO Number</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">SAP AP</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
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
                      <Link href={`/ap-reserve-invoices/${row.id}`} className="font-medium text-brand-600 hover:underline">
                        {row.portalAPNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{row.relatedPONumber}</td>
                    <td className="px-4 py-3">{row.vendor}</td>
                    <td className="px-4 py-3">{row.sapAPDocNum || '—'}</td>
                    <td className="px-4 py-3">
                      <AnimatedStatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="text-sm font-medium text-brand-600 hover:underline"
                        onClick={() => setHistoryRow(row)}
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
        documentType="APRI"
        documentId={historyRow?.id}
        documentNumber={historyRow?.portalAPNumber}
      />
    </div>
  );
}
