import { describe, expect, it } from 'vitest';
import { buildPagination } from '@/lib/errors';
import {
  parseListQuery,
  parseExportQuery,
  resolveSortField,
  PR_SORT_FIELDS,
} from '@/lib/listQuery';

describe('listQuery', () => {
  it('parses page, limit, sort, order, q, status, from, to', () => {
    const request = new Request(
      'http://localhost/api/test?page=2&limit=10&sort=portalPRNumber&order=asc&q=PR-001&status=Approved&from=2026-01-01&to=2026-12-31',
    );
    const parsed = parseListQuery(request);
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(10);
    expect(parsed.sort).toBe('portalPRNumber');
    expect(parsed.order).toBe('asc');
    expect(parsed.q).toBe('PR-001');
    expect(parsed.status).toBe('Approved');
    expect(parsed.from).toBe('2026-01-01');
    expect(parsed.to).toBe('2026-12-31');
  });

  it('rejects unsafe sort fields', () => {
    expect(resolveSortField('password', PR_SORT_FIELDS)).toBe('createdAt');
    expect(resolveSortField('portalPRNumber', PR_SORT_FIELDS)).toBe('portalPRNumber');
  });

  it('parseExportQuery allows higher limit cap', () => {
    const request = new Request('http://localhost/api/export?page=1&limit=5000');
    const parsed = parseExportQuery(request);
    expect(parsed.limit).toBe(5000);
  });

  it('buildPagination computes totalPages', () => {
    expect(buildPagination(2, 25, 100)).toEqual({
      page: 2,
      limit: 25,
      total: 100,
      totalPages: 4,
    });
  });
});
