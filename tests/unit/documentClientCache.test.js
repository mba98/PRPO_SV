import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getPortalDocument,
  invalidatePortalDocument,
  primePortalDocument,
  readPortalDocument,
} from '@/lib/documentClientCache';

describe('documentClientCache', () => {
  beforeEach(() => {
    invalidatePortalDocument('PO', 'po1');
  });

  afterEach(() => {
    invalidatePortalDocument('PO', 'po1');
  });

  it('readPortalDocument does not remove cached document', () => {
    primePortalDocument('PO', 'po1', { id: 'po1', portalPONumber: 'PO-1' });
    expect(readPortalDocument('PO', 'po1')).toEqual({ id: 'po1', portalPONumber: 'PO-1' });
    expect(getPortalDocument('PO', 'po1')).toEqual({ id: 'po1', portalPONumber: 'PO-1' });
  });

  it('getPortalDocument returns memory cache without sessionStorage', () => {
    primePortalDocument('PO', 'po1', { id: 'po1' });
    expect(getPortalDocument('PO', 'po1')).toEqual({ id: 'po1' });
    expect(getPortalDocument('PO', 'po1')).toEqual({ id: 'po1' });
  });
});

describe('fetchPortalDocument', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    invalidatePortalDocument('PO', 'po1');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    invalidatePortalDocument('PO', 'po1');
  });

  it('dedupes concurrent fetches for the same document', async () => {
    const { fetchPortalDocument } = await import('@/lib/hooks/usePortalDocument.js');

    fetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                ok: true,
                status: 200,
                text: async () =>
                  JSON.stringify({ success: true, data: { id: 'po1', portalPONumber: 'PO-1' } }),
              }),
            10,
          );
        }),
    );

    const [a, b] = await Promise.all([
      fetchPortalDocument('PO', 'po1', 'TestA'),
      fetchPortalDocument('PO', 'po1', 'TestB'),
    ]);

    expect(a).toEqual(b);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(getPortalDocument('PO', 'po1')).toEqual(a);
  });
});
