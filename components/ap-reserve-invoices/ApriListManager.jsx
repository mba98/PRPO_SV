'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/apiClient';
import { navigateWithQuery } from '@/lib/listUrl';
import { useAuthStore } from '@/stores/authStore';
import {
  PortalLoader,
  AnimatedStatusBadge,
  AnimatedTableContainer,
  FilterBar,
  Button,
} from '@/components/ui';
import { useI18n } from '@/lib/hooks/useI18n';
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
  const { common, filters: filterLabels, apri: apriI18n, po: poI18n, statusLabel } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasAnyPermission = useAuthStore((s) => s.hasAnyPermission);
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
      setError(json.message || common.errorLoad);
    }
    setLoading(false);
  }, [buildQueryParams, common.errorLoad]);

  useEffect(() => {
    load();
  }, [load]);

  function pushParams(overrides = {}) {
    navigateWithQuery(router, '/ap-reserve-invoices', buildQueryParams(overrides));
  }

  function exportExcel() {
    const params = buildQueryParams({ page: 1 });
    params.set('limit', '5000');
    window.open(`/api/export/ap-reserve-invoices?${params}`, '_blank');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-end gap-2">
        {hasAnyPermission(['apinvoice.create', 'view.all']) && (
          <Link href="/purchase-orders/ready-for-ap-reserve-invoice" className="btn-secondary min-h-10">
            {poI18n.posReadyForApri}
          </Link>
        )}
        <Button type="button" variant="secondary" onClick={exportExcel}>
          {common.exportExcel}
        </Button>
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
          <span className="form-label">{common.search}</span>
          <input
            className="input-field mt-1"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />
        </label>
        {[
          ['portalAPNumber', filterLabels.portalApri],
          ['relatedPONumber', apriI18n.relatedPo],
          ['sapAPDocNum', 'SAP AP #'],
          ['vendor', common.vendor],
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
          <span className="form-label">{common.status}</span>
          <select
            className="input-field mt-1"
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s || 'all'} value={s}>
                {s ? statusLabel(s) : filterLabels.allStatuses}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <Button type="submit" variant="secondary">
            {common.applyFilters}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setFilters({ ...EMPTY_FILTERS });
              navigateWithQuery(router, '/ap-reserve-invoices', new URLSearchParams());
            }}
          >
            {common.reset}
          </Button>
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
                  <th>{apriI18n.portalNumber}</th>
                  <th>{apriI18n.relatedPo}</th>
                  <th>{common.vendor}</th>
                  <th>SAP AP</th>
                  <th>{common.status}</th>
                  <th>{common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      {filterLabels.noResultsApri}
                    </td>
                  </tr>
                )}
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/ap-reserve-invoices/${row.id}`} className="font-medium text-primary hover:underline">
                        {row.portalAPNumber}
                      </Link>
                    </td>
                    <td>{row.relatedPONumber}</td>
                    <td>{row.vendor}</td>
                    <td className="font-mono-ltr font-mono text-xs">{row.sapAPDocNum || '—'}</td>
                    <td>
                      <AnimatedStatusBadge status={row.status} />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="min-h-10 text-sm font-semibold text-primary hover:underline"
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
        documentType="APRI"
        documentId={historyRow?.id}
        documentNumber={historyRow?.portalAPNumber}
      />
    </div>
  );
}
