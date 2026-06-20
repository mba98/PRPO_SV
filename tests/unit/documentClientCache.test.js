import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getPortalDocument,
  invalidatePortalDocument,
  lpDocumentHasDetailFlags,
  pickNewerPortalDocument,
  primePortalDocument,
  readPortalDocument,
  shouldBypassPortalDocumentCache,
} from '@/lib/documentClientCache';

const USER_A = 'user-a';
const USER_B = 'user-b';

describe('documentClientCache', () => {
  beforeEach(() => {
    invalidatePortalDocument('PO', 'po1', USER_A);
    invalidatePortalDocument('PO', 'po1', USER_B);
  });

  afterEach(() => {
    invalidatePortalDocument('PO', 'po1', USER_A);
    invalidatePortalDocument('PO', 'po1', USER_B);
  });

  it('readPortalDocument does not remove cached document', () => {
    primePortalDocument('PO', 'po1', { id: 'po1', portalPONumber: 'PO-1' }, USER_A);
    expect(readPortalDocument('PO', 'po1', USER_A)).toEqual({ id: 'po1', portalPONumber: 'PO-1' });
    expect(getPortalDocument('PO', 'po1', USER_A)).toEqual({ id: 'po1', portalPONumber: 'PO-1' });
  });

  it('scopes cache per viewer user', () => {
    primePortalDocument('PO', 'po1', { id: 'po1', canApproveCurrentStep: false }, USER_A);
    primePortalDocument('PO', 'po1', { id: 'po1', canApproveCurrentStep: true }, USER_B);

    expect(getPortalDocument('PO', 'po1', USER_A).canApproveCurrentStep).toBe(false);
    expect(getPortalDocument('PO', 'po1', USER_B).canApproveCurrentStep).toBe(true);
  });

  it('treats APRI cache without action flags as stale', () => {
    primePortalDocument('APRI', 'apri1', { id: 'apri1', status: 'warehouse_approved' }, USER_A);
    expect(getPortalDocument('APRI', 'apri1', USER_A)).toBeNull();
  });

  it('keeps APRI cache when action flags are present', () => {
    primePortalDocument(
      'APRI',
      'apri1',
      {
        id: 'apri1',
        status: 'warehouse_approved',
        canCreateInSap: true,
        canEditQuantities: false,
        canRetrySap: false,
        createInSapBlockReason: null,
      },
      USER_A,
    );
    expect(getPortalDocument('APRI', 'apri1', USER_A)?.canCreateInSap).toBe(true);
  });

  it('treats LOCAL_PURCHASE cache without detail flags as stale', () => {
    primePortalDocument(
      'LOCAL_PURCHASE',
      'lp1',
      { id: 'lp1', status: 'pending_pm', __v: 1 },
      USER_A,
    );
    expect(getPortalDocument('LOCAL_PURCHASE', 'lp1', USER_A)).toBeNull();
  });

  it('keeps LOCAL_PURCHASE cache when detail flags are present', () => {
    const payload = {
      id: 'lp1',
      status: 'completed',
      __v: 3,
      canApproveCurrentStep: false,
      workflowSteps: [{ state: 'completed' }],
    };
    primePortalDocument('LOCAL_PURCHASE', 'lp1', payload, USER_A);
    expect(lpDocumentHasDetailFlags(payload)).toBe(true);
    expect(getPortalDocument('LOCAL_PURCHASE', 'lp1', USER_A)?.status).toBe('completed');
  });

  it('always bypasses LOCAL_PURCHASE cache for network refresh', () => {
    expect(
      shouldBypassPortalDocumentCache('LOCAL_PURCHASE', {
        id: 'lp1',
        status: 'completed',
        __v: 3,
        canApproveCurrentStep: false,
        workflowSteps: [],
      }),
    ).toBe(true);
  });

  it('prefers the newer document version when resolving cache', () => {
    const cached = { id: 'lp1', status: 'pending_pm', __v: 1 };
    const fresh = { id: 'lp1', status: 'completed', __v: 3, updatedAt: '2026-06-20T06:15:53.806Z' };
    expect(pickNewerPortalDocument(cached, fresh).status).toBe('completed');
    expect(pickNewerPortalDocument(fresh, cached).status).toBe('completed');
  });
});

describe('fetchPortalDocument', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    invalidatePortalDocument('PO', 'po1', USER_A);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    invalidatePortalDocument('PO', 'po1', USER_A);
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
      fetchPortalDocument('PO', 'po1', 'TestA', USER_A),
      fetchPortalDocument('PO', 'po1', 'TestB', USER_A),
    ]);

    expect(a).toEqual(b);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(getPortalDocument('PO', 'po1', USER_A)).toEqual(a);
  });
});
