'use client';

import { common } from '@/lib/i18n';

export default function ListPagination({ pagination, page, onPageChange }) {
  if (!pagination || pagination.totalPages <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
      <p>
        {common.pageOf} {pagination.page} / {pagination.totalPages} ({pagination.total}{' '}
        {common.total})
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40"
        >
          {common.previous}
        </button>
        <button
          type="button"
          disabled={page >= pagination.totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40"
        >
          {common.next}
        </button>
      </div>
    </div>
  );
}
