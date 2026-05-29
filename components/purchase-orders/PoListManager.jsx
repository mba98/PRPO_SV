'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/apiClient';
import { navigateWithQuery } from '@/lib/listUrl';
import { useAuthStore } from '@/stores/authStore';
import {
  AnimatedFilterPanel,
  AnimatedSkeletonLoader,
  AnimatedStatusBadge,
  AnimatedTableContainer,
  AnimatedTabs,
} from '@/components/ui';
import ListPagination from '@/components/lists/ListPagination';
import ApprovalHistoryDrawer from '@/components/approval-history/ApprovalHistoryDrawer';
import { common, filters, po as poI18n } from '@/lib/i18n';

const TABS = [
  { id: 'pending', label: poI18n.pendingTab },
  { id: 'approved', label: poI18n.approvedTab },
  { id: 'rejected', label: poI18n.rejectedTab },
  { id: 'sap', label: poI18n.inSapTab },
  { id: 'all', label: poI18n.allTab, perm: 'view.all' },
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
    navigateWithQuery(router, '/purchase-orders', buildQueryParams(overrides));
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <AnimatedTabs
          tabs={visibleTabs}
          activeId={tab}
          onChange={(id) => pushParams({ tab: id, page: 1 })}
          className="w-full lg:max-w-3xl"
        />
        <div className="flex flex-wrap gap-2">
          {hasAnyPermission(['apinvoice.create', 'view.all']) && (
            <Link
              href="/purchase-orders/ready-for-ap-reserve-invoice"
              className="btn-secondary min-h-10"
            >
              {poI18n.posReadyForApri}
            </Link>
          )}
          <button type="button" onClick={exportExcel} className="btn-secondary min-h-10">
            {common.exportExcel}
          </button>
        </div>
      </div>

      <AnimatedFilterPanel>
      <form
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          pushParams({ page: 1 });
        }}
      >
        <label className="text-sm sm:col-span-2">
          <span className="text-slate-600">{common.search}</span>
          <input
            className="input-field mt-1"
            placeholder={filters.searchPo}
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />
        </label>
        {[
          ['portalPONumber', filters.portalPo],
          ['relatedPRNumber', filters.relatedPr],
          ['sapPODocNum', filters.sapPoDoc],
          ['vendor', common.vendor],
          ['status', common.status],
          ['from', common.fromDate],
          ['to', common.toDate],
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
          <button type="submit" className="btn-secondary min-h-10">
            {common.applyFilters}
          </button>
          <button
            type="button"
            className="min-h-10 text-sm text-slate-600"
            onClick={() => {
              setFilters({ ...EMPTY_FILTERS });
              navigateWithQuery(router, '/purchase-orders', new URLSearchParams({ tab }));
            }}
          >
            {common.reset}
          </button>
        </div>
      </form>
      </AnimatedFilterPanel>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <AnimatedSkeletonLoader rows={6} />
      ) : (
        <>
          <AnimatedTableContainer>
            <table className="data-table min-w-full text-sm">
              <thead>
                <tr>
                  <th>{poI18n.portalNumber}</th>
                  <th>{poI18n.relatedPr}</th>
                  <th>{common.vendor}</th>
                  <th>{common.status}</th>
                  <th>{filters.sapPoDoc}</th>
                  <th>{common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      {filters.noResultsPo}
                    </td>
                  </tr>
                )}
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/purchase-orders/${row.id}`} className="font-medium text-brand-600 hover:underline">
                        {row.portalPONumber}
                      </Link>
                    </td>
                    <td>{row.relatedPRNumber || '—'}</td>
                    <td>{row.vendor}</td>
                    <td>
                      <AnimatedStatusBadge status={row.status} />
                    </td>
                    <td className="font-mono text-xs">{row.sapPODocNum || '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="min-h-10 text-sm font-medium text-brand-600 hover:underline"
                        onClick={() => setHistoryRow(row)}
                      >
                        {common.history}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AnimatedTableContainer>
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
