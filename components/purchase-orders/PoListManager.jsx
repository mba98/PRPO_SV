'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/apiClient';
import { navigateWithQuery } from '@/lib/listUrl';
import { useAuthStore } from '@/stores/authStore';
import {
  PortalLoader,
  AnimatedStatusBadge,
  AnimatedTableContainer,
  AnimatedTabs,
} from '@/components/ui';
import ListPagination from '@/components/lists/ListPagination';
import ApprovalHistoryDrawer from '@/components/approval-history/ApprovalHistoryDrawer';
import { useI18n } from '@/lib/hooks/useI18n';
import { FilterBar, Button } from '@/components/ui';
import { PO_PENDING_TAB_PERMISSIONS } from '@/lib/poPermissions.js';

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
  const { common, filters: filterLabels, po: poI18n } = useI18n();
  const tabs = useMemo(
    () => [
      { id: 'pending', label: poI18n.pendingTab },
      { id: 'approved', label: poI18n.approvedTab },
      { id: 'rejected', label: poI18n.rejectedTab },
      { id: 'sap', label: poI18n.inSapTab },
      { id: 'all', label: poI18n.allTab, perm: 'view.all' },
    ],
    [poI18n],
  );
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const hasAnyPermission = useAuthStore((s) => s.hasAnyPermission);

  const defaultTab = hasAnyPermission(PO_PENDING_TAB_PERMISSIONS) ? 'pending' : 'approved';
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

  const visibleTabs = tabs.filter((t) => {
    if (t.perm) return hasPermission(t.perm);
    if (t.id === 'pending') {
      return hasAnyPermission(PO_PENDING_TAB_PERMISSIONS);
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

      <FilterBar>
      <form
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          pushParams({ page: 1 });
        }}
      >
        <label className="text-sm sm:col-span-2">
          <span className="text-muted-foreground">{common.search}</span>
          <input
            className="input-field mt-1"
            placeholder={filterLabels.searchPo}
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />
        </label>
        {[
          ['portalPONumber', filterLabels.portalPo],
          ['relatedPRNumber', filterLabels.relatedPr],
          ['sapPODocNum', filterLabels.sapPoDoc],
          ['vendor', common.vendor],
          ['status', common.status],
          ['from', common.fromDate],
          ['to', common.toDate],
        ].map(([key, label]) => (
          <label key={key} className="text-sm">
            <span className="text-muted-foreground">{label}</span>
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
            className="min-h-10 text-sm text-muted-foreground"
            onClick={() => {
              setFilters({ ...EMPTY_FILTERS });
              navigateWithQuery(router, '/purchase-orders', new URLSearchParams({ tab }));
            }}
          >
            {common.reset}
          </button>
        </div>
      </form>
      </FilterBar>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <div className="flex justify-center py-12">
          <PortalLoader />
        </div>
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
                  <th>{filterLabels.sapPoDoc}</th>
                  <th>{common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      {filterLabels.noResultsPo}
                    </td>
                  </tr>
                )}
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/purchase-orders/${row.id}`} className="font-medium text-primary hover:underline">
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
                        className="min-h-10 text-sm font-medium text-primary hover:underline"
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
