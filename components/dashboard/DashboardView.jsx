'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';
import {
  AnimatedDashboardCard,
  AnimatedSkeletonLoader,
  AnimatedStatusBadge,
} from '@/components/ui';

function RecentTable({ title, rows, columns, emptyMessage }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
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
                <td colSpan={columns.length} className="px-4 py-6 text-center text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {rows?.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
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
    else setError(summaryRes.json.message || 'Failed to load dashboard');
    if (recentRes.json.success) setRecent(recentRes.json.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cards = [];
  if (canViewPr && summary?.prs) {
    cards.push(
      { title: 'Total PRs', value: summary.prs.total, href: '/purchase-requests?tab=my', tone: 'default' },
      {
        title: 'PRs Pending Approval',
        value: summary.prs.pendingApproval,
        href: '/purchase-requests?tab=pending',
        tone: 'warning',
      },
      {
        title: 'PRs Created in SAP',
        value: summary.prs.createdInSap,
        href: '/purchase-requests?tab=sap',
        tone: 'success',
      },
    );
  }
  if (canViewPo && summary?.pos) {
    cards.push(
      { title: 'Total POs', value: summary.pos.total, href: '/purchase-orders', tone: 'default' },
      {
        title: 'POs Pending Approval',
        value: summary.pos.pendingApproval,
        href: '/purchase-orders?tab=pending',
        tone: 'warning',
      },
      {
        title: 'POs Created in SAP',
        value: summary.pos.createdInSap,
        href: '/purchase-orders?tab=sap',
        tone: 'success',
      },
    );
  }
  if (canViewApri && summary?.apri) {
    cards.push({
      title: 'APRIs Created in SAP',
      value: summary.apri.createdInSap,
      href: '/ap-reserve-invoices',
      tone: 'success',
    });
  }
  if (canViewLogs && summary?.sap) {
    cards.push({
      title: 'Failed SAP Integrations',
      value: summary.sap.failedIntegrations,
      href: '/settings/system-logs?log=sap',
      tone: 'danger',
    });
  }
  if (canViewLogs && summary?.email?.failedEmails != null) {
    cards.push({
      title: 'Failed Emails',
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
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Key metrics</h2>
        {loading ? (
          <AnimatedSkeletonLoader rows={3} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cards.map((card) => (
              <AnimatedDashboardCard key={card.title} {...card} loading={loading} />
            ))}
          </div>
        )}
      </section>

      {loading ? (
        <AnimatedSkeletonLoader variant="table" rows={4} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {canViewPr && (
            <RecentTable
              title="Recent purchase requests"
              rows={recent?.purchaseRequests}
              emptyMessage="No recent purchase requests"
              columns={[
                {
                  key: 'num',
                  label: 'PR #',
                  render: (r) => (
                    <Link
                      href={`/purchase-requests/${r.id}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {r.portalPRNumber}
                    </Link>
                  ),
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (r) => <AnimatedStatusBadge status={r.status} />,
                },
                {
                  key: 'created',
                  label: 'Created',
                  render: (r) =>
                    r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—',
                },
              ]}
            />
          )}
          {canViewPo && (
            <RecentTable
              title="Recent purchase orders"
              rows={recent?.purchaseOrders}
              emptyMessage="No recent purchase orders"
              columns={[
                {
                  key: 'num',
                  label: 'PO #',
                  render: (r) => (
                    <Link
                      href={`/purchase-orders/${r.id}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {r.portalPONumber}
                    </Link>
                  ),
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (r) => <AnimatedStatusBadge status={r.status} />,
                },
                {
                  key: 'vendor',
                  label: 'Vendor',
                  render: (r) => r.vendor || '—',
                },
              ]}
            />
          )}
          {canViewApri && (
            <RecentTable
              title="Recent AP reserve invoices"
              rows={recent?.apReserveInvoices}
              emptyMessage="No recent APRIs"
              columns={[
                {
                  key: 'num',
                  label: 'APRI #',
                  render: (r) => (
                    <Link
                      href={`/ap-reserve-invoices/${r.id}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {r.portalAPNumber}
                    </Link>
                  ),
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (r) => <AnimatedStatusBadge status={r.status} />,
                },
              ]}
            />
          )}
          {canViewLogs && (
            <RecentTable
              title="Recent SAP failures"
              rows={recent?.sapFailures}
              emptyMessage="No recent SAP failures"
              columns={[
                { key: 'type', label: 'Type', render: (r) => r.documentType },
                { key: 'action', label: 'Action', render: (r) => r.action },
                {
                  key: 'error',
                  label: 'Error',
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
