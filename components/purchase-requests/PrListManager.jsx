'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/apiClient';
import { navigateWithQuery } from '@/lib/listUrl';
import { useAuthStore } from '@/stores/authStore';
import {
  AnimatedSkeletonLoader,
  AnimatedStatusBadge,
  AnimatedTableContainer,
  AnimatedTabs,
} from '@/components/ui';
import { PR_STATUSES } from '@/lib/prPermissions';
import ListPagination from '@/components/lists/ListPagination';
import ApprovalHistoryDrawer from '@/components/approval-history/ApprovalHistoryDrawer';
import { useI18n } from '@/lib/hooks/useI18n';
import { formatDate } from '@/lib/formatDate';
import { FilterBar, Button } from '@/components/ui';

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
  const { common, filters: filterLabels, pr: prI18n, statusLabel, locale } = useI18n();
  const tabs = useMemo(
    () => [
      { id: 'my', label: prI18n.myPrs },
      { id: 'pending', label: prI18n.pendingApproval },
      { id: 'approved', label: prI18n.postApproval },
      { id: 'failed-sap', label: prI18n.failedSapTab },
      { id: 'rejected', label: prI18n.rejectedTab },
      { id: 'sap', label: prI18n.inSapTab },
      { id: 'all', label: prI18n.allTab, perm: 'view.all' },
    ],
    [prI18n],
  );
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
      setError(json.message || common.errorLoad);
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

  const visibleTabs = tabs.filter((t) => {
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <AnimatedTabs tabs={visibleTabs} activeId={tab} onChange={setTab} className="w-full lg:max-w-4xl" />
        <div className="flex flex-wrap gap-2">
          {hasAnyPermission(['po.create', 'view.all']) && (
            <Link href="/purchase-requests/approved-for-po" className="btn-secondary min-h-10">
              {prI18n.prsReadyForPo}
            </Link>
          )}
          <button type="button" onClick={exportExcel} className="btn-secondary min-h-10">
            {common.exportExcel}
          </button>
          {hasPermission('pr.create') && (
            <Link href="/purchase-requests/create" className="btn-primary min-h-10">
              {prI18n.newPr}
            </Link>
          )}
        </div>
      </div>

      <FilterBar>
      <form onSubmit={applyFilters} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm sm:col-span-2">
            <span className="text-muted-foreground">{common.search}</span>
            <input
              className="input-field mt-1"
              placeholder={filterLabels.searchPr}
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            />
          </label>
          {[
            ['portalPRNumber', filterLabels.portalPr],
            ['sapPRDocNum', filterLabels.sapPrDoc],
            ['department', common.department],
            ['project', common.project],
            ['warehouse', common.warehouse],
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
          <label className="text-sm">
            <span className="text-muted-foreground">{common.status}</span>
            <select
              className="input-field mt-1"
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">{filterLabels.allStatuses}</option>
              {PR_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn-secondary min-h-10">
            {common.applyFilters}
          </button>
          <button type="button" onClick={resetFilters} className="min-h-10 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
            {common.reset}
          </button>
        </div>
      </form>
      </FilterBar>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <AnimatedSkeletonLoader rows={6} />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {items.length === 0 && (
              <p className="rounded-lg border border-border bg-card px-4 py-8 text-center text-muted-foreground">
                {filterLabels.noResultsPr}
              </p>
            )}
            {items.map((row) => (
              <article key={row.id} className="card space-y-2">
                <Link
                  href={`/purchase-requests/${row.id}`}
                  className="text-base font-semibold text-primary hover:underline"
                >
                  {row.portalPRNumber}
                </Link>
                <div className="flex flex-wrap items-center gap-2">
                  <AnimatedStatusBadge status={row.status} />
                  <span className="text-sm text-muted-foreground">{row.department}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  SAP: {row.sapPRDocNum || '—'} ·{' '}
                  {formatDate(row.createdAt, locale)}
                </p>
                <button
                  type="button"
                  className="min-h-10 text-sm font-medium text-primary"
                  onClick={() => setHistoryRow(row)}
                >
                  {common.history}
                </button>
              </article>
            ))}
          </div>
          <AnimatedTableContainer className="hidden md:block">
            <table className="data-table min-w-full text-sm">
              <thead>
                <tr>
                  <th className="sticky start-0 z-10 bg-muted">
                    <button type="button" onClick={() => toggleSort('portalPRNumber')}>
                      {prI18n.portalNumber}
                    </button>
                  </th>
                  <th>{common.department}</th>
                  <th>{common.status}</th>
                  <th>{prI18n.sapDocNum}</th>
                  <th>
                    <button type="button" onClick={() => toggleSort('createdAt')}>
                      {common.createdAt}
                    </button>
                  </th>
                  <th>{common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      {filterLabels.noResultsPr}
                    </td>
                  </tr>
                )}
                {items.map((row) => (
                  <tr key={row.id}>
                    <td className="sticky start-0 z-10 bg-card">
                      <Link
                        href={`/purchase-requests/${row.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {row.portalPRNumber}
                      </Link>
                    </td>
                    <td>{row.department}</td>
                    <td>
                      <AnimatedStatusBadge status={row.status} />
                    </td>
                    <td className="font-mono text-xs">{row.sapPRDocNum || '—'}</td>
                    <td className="text-muted-foreground">
                      {formatDate(row.createdAt, locale)}
                    </td>
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
        documentType="PR"
        documentId={historyRow?.id}
        documentNumber={historyRow?.portalPRNumber}
      />
    </div>
  );
}
