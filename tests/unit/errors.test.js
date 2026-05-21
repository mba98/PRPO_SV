import { describe, expect, it } from 'vitest';
import {
  buildPagination,
  conflictResponse,
  failureResponse,
  parseListQuery,
  successResponse,
  validationFailureResponse,
} from '@/lib/errors';

describe('errors envelope helpers', () => {
  it('builds success response with optional pagination', () => {
    expect(successResponse({ id: 1 })).toEqual({ success: true, data: { id: 1 } });
    expect(successResponse([], { page: 1, limit: 25, total: 0, totalPages: 1 })).toEqual({
      success: true,
      data: [],
      pagination: { page: 1, limit: 25, total: 0, totalPages: 1 },
    });
  });

  it('builds failure and validation responses', () => {
    expect(failureResponse('Denied', 'FORBIDDEN', '403')).toEqual({
      success: false,
      message: 'Denied',
      error: 'FORBIDDEN',
      code: '403',
    });
    expect(validationFailureResponse([{ path: 'email', message: 'Invalid' }])).toEqual({
      success: false,
      message: 'Validation failed',
      errors: [{ path: 'email', message: 'Invalid' }],
    });
    expect(conflictResponse()).toEqual({
      success: false,
      message: 'Document changed, please reload',
    });
  });

  it('parses list query params from request URL', () => {
    const request = new Request(
      'http://localhost/api/items?page=2&limit=10&sort=updatedAt&order=asc&q=test&status=Draft',
    );
    const parsed = parseListQuery(request);
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(10);
    expect(parsed.sort).toBe('updatedAt');
    expect(parsed.order).toBe('asc');
    expect(parsed.q).toBe('test');
    expect(parsed.status).toBe('Draft');
  });

  it('builds pagination metadata', () => {
    expect(buildPagination(1, 25, 100)).toEqual({
      page: 1,
      limit: 25,
      total: 100,
      totalPages: 4,
    });
  });
});
