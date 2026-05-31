'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';
import {
  AnimatedDashboardCard,
  PortalLoader,
  AnimatedStatusBadge,
} from '@/components/ui';
import { useI18n } from '@/lib/hooks/useI18n';
import { formatDate } from '@/lib/formatDate';

function RecentTable({ title, rows, columns, emptyMessage }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-xl shadow-black/5">
      <div className="border-b border-border px-4 py-3">
        <h3 className="font-bold text-foreground">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-2">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!rows?.length && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {rows?.map((row) => (
              <tr key={row.id} className="border-t border-border hover:bg-muted/30">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-2">
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DashboardView() {
  const { common, dashboard: dashI18n, pr, po, apri, locale } = useI18n();
  const hasAnyPermission = useAuthStore((s) => s.hasAnyPermission);
  const canViewLogs = hasAnyPermission(['view.all', 'admin.settings']);
  const canViewPr = hasAnyPermission(['pr.create', 'pr.approve.whs', 'pr.approve.pm', 'view.all']);
  const canViewPo = hasAnyPermission([
    'po.create',
    'po.approve.pm',
    'po.approve.finance',
    'view.all',
  ]);
  const canViewApri = hasAnyPermission(['apinvoice.create', 'view.all']);

  const [summary, setSummary] = useState(null);
  const [recent, setRecent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [summaryRes, recentRes] = await Promise.all([
      apiFetch('/api/dashboard/summary'),
      apiFetch('/api/dashboard/recent?limit=5'),
    ]);
    if (summaryRes.json.success) setSummary(summaryRes.json.data);
    else setError(summaryRes.json.message || common.errorLoad);
    if (recentRes.json.success) setRecent(recentRes.json.data);
    setLoading(false);
  }, [common.errorLoad]);

  useEffect(() => {
    load();
  }, [load]);

  const cards = [];
  if (canViewPr && summary?.prs) {
    cards.push(
      { title: dashI18n.totalPrs, value: summary.prs.total, href: '/purchase-requests?tab=my', tone: 'default' },
      {
        title: dashI18n.prsPending,
        value: summary.prs.pendingApproval,
        href: '/purchase-requests?tab=pending',
        tone: 'warning',
      },
      {
        title: dashI18n.prsInSap,
        value: summary.prs.createdInSap,
        href: '/purchase-requests?tab=sap',
        tone: 'success',
      },
    );
  }
  if (canViewPo && summary?.pos) {
    cards.push(
      { title: dashI18n.totalPos, value: summary.pos.total, href: '/purchase-orders', tone: 'default' },
      {
        title: dashI18n.posPending,
        value: summary.pos.pendingApproval,
        href: '/purchase-orders?tab=pending',
        tone: 'warning',
      },
      {
        title: dashI18n.posInSap,
        value: summary.pos.createdInSap,
        href: '/purchase-orders?tab=sap',
        tone: 'success',
      },
    );
  }
  if (canViewApri && summary?.apri) {
    cards.push({
      title: dashI18n.apriCreated,
      value: summary.apri.createdInSap,
      href: '/ap-reserve-invoices',
      tone: 'success',
    });
  }
  if (canViewLogs && summary?.sap) {
    cards.push({
      title: dashI18n.sapFailures,
      value: summary.sap.failedIntegrations,
      href: '/settings/system-logs?log=sap',
      tone: 'danger',
    });
  }
  if (canViewLogs && summary?.email?.failedEmails != null) {
    cards.push({
      title: dashI18n.emailFailures,
      value: summary.email.failedEmails,
      href: '/settings/system-logs?log=email',
      tone: 'danger',
    });
  }

  return (
    <div className="space-y-8">
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <section>
        <h2 className="mb-4 text-lg font-bold text-foreground">{dashI18n.title}</h2>
        {loading ? (
          <div className="col-span-full">
            <PortalLoader />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cards.map((card) => (
              <AnimatedDashboardCard key={card.title} {...card} loading={loading} />
            ))}
          </div>
        )}
      </section>

      {loading ? (
        <PortalLoader />
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {canViewPr && (
            <RecentTable
              title={dashI18n.recentPrs}
              rows={recent?.purchaseRequests}
              emptyMessage={pr.noPrs}
              columns={[
                {
                  key: 'num',
                  label: 'PR #',
                  render: (r) => (
                    <Link
                      href={`/purchase-requests/${r.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {r.portalPRNumber}
                    </Link>
                  ),
                },
                {
                  key: 'status',
                  label: common.status,
                  render: (r) => <AnimatedStatusBadge status={r.status} />,
                },
                {
                  key: 'created',
                  label: common.createdAt,
                  render: (r) =>
                    formatDate(r.createdAt, locale),
                },
              ]}
            />
          )}
          {canViewPo && (
            <RecentTable
              title={dashI18n.recentPos}
              rows={recent?.purchaseOrders}
              emptyMessage={po.noPos}
              columns={[
                {
                  key: 'num',
                  label: 'PO #',
                  render: (r) => (
                    <Link
                      href={`/purchase-orders/${r.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {r.portalPONumber}
                    </Link>
                  ),
                },
                {
                  key: 'status',
                  label: common.status,
                  render: (r) => <AnimatedStatusBadge status={r.status} />,
                },
                {
                  key: 'vendor',
                  label: common.vendor,
                  render: (r) => r.vendor || '—',
                },
              ]}
            />
          )}
          {canViewApri && (
            <RecentTable
              title={dashI18n.recentApri}
              rows={recent?.apReserveInvoices}
              emptyMessage={apri.noApri}
              columns={[
                {
                  key: 'num',
                  label: 'APRI #',
                  render: (r) => (
                    <Link
                      href={`/ap-reserve-invoices/${r.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {r.portalAPNumber}
                    </Link>
                  ),
                },
                {
                  key: 'status',
                  label: common.status,
                  render: (r) => <AnimatedStatusBadge status={r.status} />,
                },
              ]}
            />
          )}
          {canViewLogs && (
            <RecentTable
              title={dashI18n.recentSapFailures}
              rows={recent?.sapFailures}
              emptyMessage={common.noData}
              columns={[
                { key: 'type', label: common.status, render: (r) => r.documentType },
                { key: 'action', label: common.actions, render: (r) => r.action },
                {
                  key: 'error',
                  label: common.failed,
                  render: (r) => (
                    <span className="line-clamp-2 text-xs text-red-700">{r.errorMessage || '—'}</span>
                  ),
                },
              ]}
            />
          )}
        </div>
      )}
    </div>
  );
}
