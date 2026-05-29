import { describe, expect, it, vi } from 'vitest';
import { queryStringFromParams, navigateWithQuery } from '@/lib/listUrl';

describe('listUrl', () => {
  it('stringifies URLSearchParams', () => {
    expect(queryStringFromParams(new URLSearchParams({ tab: 'my', page: '1' }))).toBe('tab=my&page=1');
  });

  it('skips router.push when query unchanged', () => {
    const push = vi.fn();
    const replace = vi.fn();
    const router = { push, replace };
    navigateWithQuery(router, '/purchase-requests', new URLSearchParams({ tab: 'my', page: '1' }), {
      currentQuery: 'tab=my&page=1',
    });
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('calls router.push when query differs', () => {
    const push = vi.fn();
    const router = { push, replace: vi.fn() };
    navigateWithQuery(router, '/purchase-requests', new URLSearchParams({ tab: 'pending', page: '1' }), {
      currentQuery: 'tab=my',
    });
    expect(push).toHaveBeenCalledWith('/purchase-requests?tab=pending&page=1');
  });
});
