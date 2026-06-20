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
  FilterBar,
  Button,
} from '@/components/ui';
import ListPagination from '@/components/lists/ListPagination';
import ApprovalHistoryDrawer from '@/components/approval-history/ApprovalHistoryDrawer';
import { useI18n } from '@/lib/hooks/useI18n';
import { LP_APPROVAL_PERMISSIONS } from '@/lib/permissions.js';

const EMPTY_FILTERS = {
  portalLPNumber: '',
  status: '',
  from: '',
  to: '',
};

export default function LpListManager() {
  const { common, filters: filterLabels, lp: lpI18n } = useI18n();
  const tabs = useMemo(
    () => [
      { id: 'my', label: lpI18n.myTab },
      { id: 'pending', label: lpI18n.pendingTab },
      { id: 'rejected', label: lpI18n.rejectedTab },
      { id: 'completed', label: lpI18n.completedTab },
      { id: 'all', label: lpI18n.allTab, perm: 'lp.view.all' },
    ],
    [lpI18n],
  );
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const hasAnyPermission = useAuthStore((s) => s.hasAnyPermission);

  const defaultTab = hasAnyPermission(LP_APPROVAL_PERMISSIONS) ? 'pending' : 'my';
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
    portalLPNumber: searchParams.get('portalLPNumber') || '',
    status: searchParams.get('status') || '',
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || '',
  });

  const visibleTabs = tabs.filter((t) => !t.perm || hasPermission(t.perm));

  const buildQueryParams = useCallback(
    (overrides = {}) => {
      const params = new URLSearchParams({
        tab: overrides.tab ?? tab,
        page: String(overrides.page ?? page),
        limit: '25',
        sort,
        order,
      });
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      return params;
    },
    [tab, page, sort, order, filters],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      const params = buildQueryParams();
      const { json } = await apiFetch(`/api/local-purchases?${params}`, {
        source: 'LpListManager',
      });
      if (cancelled) return;
      if (!json.success) {
        setError(json.message || 'Failed to load');
        setItems([]);
        setPagination(null);
      } else {
        setItems(Array.isArray(json.data) ? json.data : []);
        setPagination(json.pagination || null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [buildQueryParams]);

  function applyFilters() {
    navigateWithQuery(router, '/local-purchases', buildQueryParams({ page: 1 }));
  }

  if (loading && !items.length) return <PortalLoader />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AnimatedTabs
          tabs={visibleTabs}
          active={tab}
          onChange={(next) =>
            navigateWithQuery(router, '/local-purchases', buildQueryParams({ tab: next, page: 1 }))
          }
        />
        {hasPermission('lp.create') && (
          <Link href="/local-purchases/new" className="btn-primary">
            {lpI18n.createNew}
          </Link>
        )}
      </div>

      <FilterBar
        onApply={applyFilters}
        onReset={() => {
          setFilters(EMPTY_FILTERS);
          navigateWithQuery(router, '/local-purchases', new URLSearchParams({ tab, page: '1' }));
        }}
        fields={[
          ['portalLPNumber', lpI18n.portalNumber],
          ['status', common.status],
          ['from', filterLabels.from],
          ['to', filterLabels.to],
        ].map(([key, label]) => ({
          key,
          label,
          value: filters[key],
          onChange: (value) => setFilters((prev) => ({ ...prev, [key]: value })),
        }))}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <AnimatedTableContainer>
        <table className="data-table">
          <thead>
            <tr>
              <th>{lpI18n.portalNumber}</th>
              <th>{lpI18n.requestDate}</th>
              <th>{lpI18n.budget}</th>
              <th>{lpI18n.documentTotal}</th>
              <th>{lpI18n.numberOfItems}</th>
              <th>{common.status}</th>
              <th>{lpI18n.createdBy}</th>
              <th>{common.createdAt}</th>
              <th>{common.actions}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id}>
                <td>
                  <Link href={`/local-purchases/${row.id}`} className="link-primary">
                    {row.portalLPNumber}
                  </Link>
                </td>
                <td>{row.documentDate ? new Date(row.documentDate).toLocaleDateString() : '—'}</td>
                <td>{Number(row.budget ?? 0).toFixed(2)}</td>
                <td>{Number(row.documentTotal || 0).toFixed(2)}</td>
                <td>{row.lineCount ?? 0}</td>
                <td>
                  <AnimatedStatusBadge status={row.status} />
                </td>
                <td>{row.createdByName || '—'}</td>
                <td>{row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}</td>
                <td className="flex gap-2">
                  <Link href={`/local-purchases/${row.id}`} className="btn-secondary btn-sm">
                    {lpI18n.view}
                  </Link>
                  <Button type="button" variant="ghost" onClick={() => setHistoryRow(row)}>
                    {common.history}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AnimatedTableContainer>

      {!items.length && !loading && <p className="text-sm text-muted-foreground">{lpI18n.noItems}</p>}

      <ListPagination
        pagination={pagination}
        onPageChange={(nextPage) =>
          navigateWithQuery(router, '/local-purchases', buildQueryParams({ page: nextPage }))
        }
      />

      {historyRow && (
        <ApprovalHistoryDrawer
          documentType="LOCAL_PURCHASE"
          documentId={historyRow.id}
          title={historyRow.portalLPNumber}
          onClose={() => setHistoryRow(null)}
        />
      )}
    </div>
  );
}
