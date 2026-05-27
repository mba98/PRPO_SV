'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';
import { AnimatedSkeletonLoader, AnimatedStatusBadge } from '@/components/ui';
import SettingsTable from './SettingsTable';
import { WORKFLOW_EMAIL_EVENT_KEYS } from '@/lib/emailRecipientConfig';

const DOC_TYPES = ['', 'PR', 'PO', 'APRI'];
const STATUSES = ['', 'Sent', 'Failed'];

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function truncate(value, max = 80) {
  if (!value) return '—';
  const s = String(value);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export default function EmailLogsManager() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    page: 1,
    limit: 25,
    q: '',
    eventKey: '',
    relatedDocumentType: '',
    emailStatus: '',
    from: '',
    to: '',
  });

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    params.set('page', String(filters.page));
    params.set('limit', String(filters.limit));
    if (filters.eventKey) params.set('eventKey', filters.eventKey);
    if (filters.relatedDocumentType) params.set('relatedDocumentType', filters.relatedDocumentType);
    if (filters.emailStatus) params.set('emailStatus', filters.emailStatus);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    if (filters.q?.trim()) params.set('q', filters.q.trim());

    const { json, status } = await apiFetch(`/api/email/logs?${params.toString()}`);
    if (json.success) {
      setLogs(json.data);
      setPagination(json.pagination);
    } else if (status === 403) {
      setError('You do not have permission to view email logs.');
    } else {
      setError(json.message || 'Failed to load email logs');
    }
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const columns = [
    { key: 'sentAt', label: 'Sent', render: (row) => formatDate(row.sentAt) },
    {
      key: 'emailStatus',
      label: 'Status',
      render: (row) => (
        <AnimatedStatusBadge status={row.emailStatus === 'Sent' ? 'Healthy' : 'Failed'} />
      ),
    },
    { key: 'eventKey', label: 'Event', render: (row) => row.eventKey || '—' },
    { key: 'subject', label: 'Subject', render: (row) => truncate(row.subject, 60) },
    {
      key: 'to',
      label: 'To',
      render: (row) => (row.to?.length ? row.to.join(', ') : '—'),
    },
    {
      key: 'document',
      label: 'Document',
      render: (row) =>
        row.relatedDocumentType && row.relatedDocumentId
          ? `${row.relatedDocumentType} · ${row.relatedDocumentId.slice(-6)}`
          : '—',
    },
    {
      key: 'errorMessage',
      label: 'Error',
      render: (row) => (
        <span className="text-xs text-red-700" title={row.errorMessage || ''}>
          {truncate(row.errorMessage, 50)}
        </span>
      ),
    },
  ];

  const tableRows = logs.map((log) => ({ key: log.id, data: log }));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">Search</label>
          <input
            type="search"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value, page: 1 }))}
            placeholder="Subject, event, error…"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">Status</label>
          <select
            value={filters.emailStatus}
            onChange={(e) => setFilters((f) => ({ ...f, emailStatus: e.target.value, page: 1 }))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s || 'all'} value={s}>
                {s || 'All'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">Event</label>
          <select
            value={filters.eventKey}
            onChange={(e) => setFilters((f) => ({ ...f, eventKey: e.target.value, page: 1 }))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All events</option>
            {WORKFLOW_EMAIL_EVENT_KEYS.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">Document type</label>
          <select
            value={filters.relatedDocumentType}
            onChange={(e) =>
              setFilters((f) => ({ ...f, relatedDocumentType: e.target.value, page: 1 }))
            }
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {DOC_TYPES.map((t) => (
              <option key={t || 'all'} value={t}>
                {t || 'All'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">From date</label>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value, page: 1 }))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">To date</label>
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value, page: 1 }))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => loadLogs()}
            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
          >
            Apply filters
          </button>
          <button
            type="button"
            onClick={() =>
              setFilters({
                page: 1,
                limit: 25,
                q: '',
                eventKey: '',
                relatedDocumentType: '',
                emailStatus: '',
                from: '',
                to: '',
              })
            }
            className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Reset
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {loading ? (
        <AnimatedSkeletonLoader rows={8} />
      ) : (
        <SettingsTable columns={columns} rows={tableRows} emptyMessage="No email logs found." />
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <button
            type="button"
            disabled={filters.page <= 1}
            onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
            className="rounded border px-3 py-1 disabled:opacity-40"
          >
            Previous
          </button>
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            type="button"
            disabled={filters.page >= pagination.totalPages}
            onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
            className="rounded border px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
