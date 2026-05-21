import { describe, expect, it, vi } from 'vitest';
import { sapLookupFailureResponse } from '@/lib/sapLookupApi';

describe('sapLookupApi', () => {
  it('returns user-friendly message without raw ODBC text', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = sapLookupFailureResponse('test', new Error('[odbc] secret detail'), 'Failed to search SAP items');
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toBe('Failed to search SAP items');
    expect(body.message).not.toContain('odbc');
    expect(body.error).toBe('SAP_LOOKUP_FAILED');
    consoleSpy.mockRestore();
  });

  it('maps missing HANA config to HANA_UNAVAILABLE', async () => {
    const res = sapLookupFailureResponse(
      'test',
      new Error('HANA_CONNECTION_STRING is not configured'),
      'Failed to search SAP items',
    );
    const body = await res.json();
    expect(body.error).toBe('HANA_UNAVAILABLE');
  });
});
