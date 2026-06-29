import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('@/lib/exchangeRateClient.js', () => ({
  fetchSapExchangeRate: vi.fn(),
}));

import { fetchSapExchangeRate } from '@/lib/exchangeRateClient.js';
import { loadPoExchangeRateForForm } from '@/lib/hooks/usePoExchangeRate.js';

describe('usePoExchangeRate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('PoBusinessFields loads exchange rates through shared hook', () => {
    const businessFields = fs.readFileSync(
      path.resolve(process.cwd(), 'components/purchase-orders/PoBusinessFields.jsx'),
      'utf8',
    );
    const hook = fs.readFileSync(
      path.resolve(process.cwd(), 'lib/hooks/usePoExchangeRate.js'),
      'utf8',
    );
    expect(businessFields).toContain('usePoExchangeRate');
    expect(businessFields).toContain('readOnly');
    expect(businessFields).not.toMatch(/onChange=\{.*docRate/);
    expect(hook).toContain('AbortController');
    expect(hook).toContain('requestIdRef');
  });

  it('loadPoExchangeRateForForm returns SAP rate for foreign currency', async () => {
    fetchSapExchangeRate.mockResolvedValueOnce({ rate: 1450, currency: 'USD', date: '2026-06-29' });
    const result = await loadPoExchangeRateForForm('USD', '2026-06-29');
    expect(result.rate).toBe(1450);
    expect(result.aborted).toBe(false);
  });

  it('loadPoExchangeRateForForm propagates fetch errors', async () => {
    fetchSapExchangeRate.mockRejectedValueOnce(new Error('No SAP exchange rate'));
    await expect(loadPoExchangeRateForForm('USD', '2026-06-29')).rejects.toThrow(
      'No SAP exchange rate',
    );
  });
});
