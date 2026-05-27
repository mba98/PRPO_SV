'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';
import { AnimatedSkeletonLoader, AnimatedStatusBadge } from '@/components/ui';
import SettingsTable from './SettingsTable';
import ListPagination from '@/components/lists/ListPagination';

const DOC_TYPES = ['', 'PR', 'PO', 'APRI', 'ITEM'];
const STATUSES = ['', 'Success', 'Failed'];

export default function SapIntegrationLogsManager() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    page: 1,
    q: '',
    documentType: '',
    status: 'Failed',
    action: '',
    from: '',
    to: '',
  });

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    params.set('page', String(filters.page));
    params.set('limit', '25');
    if (filters.q) params.set('q', filters.q);
    if (filters.documentType) params.set('documentType', filters.documentType);
    if (filters.status) params.set('status', filters.status);
    if (filters.action) params.set('action', filters.action);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);

    const { json } = await apiFetch(`/api/sap/integration-logs?${params}`);
    if (json.success) {
      setLogs(json.data);
      setPagination(json.pagination);
    } else {
      setError(json.message || 'Failed to load SAP logs');
    }
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const columns = [
    { key: 'createdAt', label: 'When', render: (r) => (r.createdAt ? new Date(r.createdAt).toLocaleString() : '—') },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <AnimatedStatusBadge status={r.status === 'Success' ? 'Healthy' : 'Failed'} />,
    },
    { key: 'documentType', label: 'Type' },
    { key: 'action', label: 'Action' },
    { key: 'sapDocNum', label: 'SAP Doc', render: (r) => r.sapDocNum || '—' },
    {
      key: 'errorMessage',
      label: 'Error',
      render: (r) => (
        <span className="text-xs text-red-700" title={r.errorMessage || ''}>
          {r.errorMessage ? `${r.errorMessage.slice(0, 60)}${r.errorMessage.length > 60 ? '…' : ''}` : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs font-semibold uppercase text-slate-500">Search</label>
        <input
          className="input-field sm:col-span-2"
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value, page: 1 }))}
        />
        <label className="text-xs font-semibold uppercase text-slate-500">Document type</label>
        <select
          className="input-field"
          value={filters.documentType}
          onChange={(e) => setFilters((f) => ({ ...f, documentType: e.target.value, page: 1 }))}
        >
          {DOC_TYPES.map((t) => (
            <option key={t || 'all'} value={t}>
              {t || 'All'}
            </option>
          ))}
        </select>
        <label className="text-xs font-semibold uppercase text-slate-500">Status</label>
        <select
          className="input-field"
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}
        >
          {STATUSES.map((s) => (
            <option key={s || 'all'} value={s}>
              {s || 'All'}
            </option>
          ))}
        </select>
        <label className="text-xs font-semibold uppercase text-slate-500">From</label>
        <input
          type="date"
          className="input-field"
          value={filters.from}
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value, page: 1 }))}
        />
        <label className="text-xs font-semibold uppercase text-slate-500">To</label>
        <input
          type="date"
          className="input-field"
          value={filters.to}
          onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value, page: 1 }))}
        />
        <div className="flex items-end sm:col-span-2">
          <button type="button" onClick={loadLogs} className="btn-secondary">
            Apply filters
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {loading ? (
        <AnimatedSkeletonLoader rows={8} />
      ) : (
        <>
          <SettingsTable
            columns={columns}
            rows={logs.map((log) => ({ key: log.id, data: log }))}
            emptyMessage="No SAP integration logs found."
          />
          <ListPagination
            pagination={pagination}
            page={filters.page}
            onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
          />
        </>
      )}
    </div>
  );
}
