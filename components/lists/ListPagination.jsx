'use client';

import { useI18n } from '@/lib/hooks/useI18n';
import Button from '@/components/ui/Button';

export default function ListPagination({ pagination, page, onPageChange }) {
  const { common } = useI18n();
  if (!pagination || pagination.totalPages <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <p>
        {common.pageOf} {pagination.page} / {pagination.totalPages} ({pagination.total}{' '}
        {common.total})
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          {common.previous}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={page >= pagination.totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {common.next}
        </Button>
      </div>
    </div>
  );
}
