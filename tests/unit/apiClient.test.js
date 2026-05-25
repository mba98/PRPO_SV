import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/apiClient';

describe('apiFetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns parsed JSON on success', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, data: { id: '1' } }),
    });
    const { ok, json } = await apiFetch('/api/test');
    expect(ok).toBe(true);
    expect(json.success).toBe(true);
    expect(json.data.id).toBe('1');
  });

  it('does not throw on network failure', async () => {
    fetch.mockRejectedValueOnce(new Error('Failed to fetch'));
    const { ok, json } = await apiFetch('/api/test');
    expect(ok).toBe(false);
    expect(json.success).toBe(false);
    expect(json.message).toContain('Network');
  });

  it('returns friendly message for non-JSON error responses', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });
    const { json } = await apiFetch('/api/test');
    expect(json.success).toBe(false);
    expect(json.message).toContain('500');
  });
});
