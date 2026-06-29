import { beforeEach, describe, expect, it, vi } from 'vitest';

const slGetRate = vi.fn();
const hanaGetRate = vi.fn();

vi.mock('@/lib/sapServiceLayer.js', () => ({
  getCurrencyRateFromServiceLayer: (...args) => slGetRate(...args),
}));

vi.mock('@/lib/sapHana.js', () => ({
  getExchangeRateFromHana: (...args) => hanaGetRate(...args),
}));

import {
  buildExchangeRateCacheKey,
  clearExchangeRateCache,
  getSapExchangeRate,
  resolvePoExchangeRateForDocument,
  SAP_EXCHANGE_RATE_NOT_FOUND_CODE,
} from '@/lib/sap/exchangeRates.js';
import { normalizeExchangeRateDate } from '@/lib/poExchangeRateUtils.js';
import { requiresPoDocRate, getPoExchangeRateSubmitBlocker } from '@/lib/poCurrency.js';
import { buildExchangeRateSql } from '@/lib/sap/hanaSql.js';

describe('SAP exchange rates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearExchangeRateCache();
    process.env.SAP_SL_BASE_URL = 'https://sap.example/b1s/v2';
    process.env.SAP_SL_USERNAME = 'user';
    process.env.SAP_SL_PASSWORD = 'pass';
    process.env.SAP_SL_COMPANY_DB = 'DB';
    process.env.HANA_CONNECTION_STRING = 'Driver={HDBODBC};...';
  });

  it('normalizes document dates to YYYY-MM-DD', () => {
    expect(normalizeExchangeRateDate('2026-06-29')).toBe('2026-06-29');
    expect(normalizeExchangeRateDate(new Date('2026-06-29T12:00:00Z'))).toBe('2026-06-29');
  });

  it('builds ORTT SQL for exact currency and date match', () => {
    const sql = buildExchangeRateSql('SBODEMOUS');
    expect(sql).toContain('"ORTT"');
    expect(sql).toContain('TO_VARCHAR(T0."RateDate", \'YYYY-MM-DD\')');
  });

  it('prefers Service Layer rate then caches by currency:date', async () => {
    slGetRate.mockResolvedValueOnce(1450);
    const first = await getSapExchangeRate('USD', '2026-06-29');
    expect(first.rate).toBe(1450);
    expect(first.source).toBe('SAP_SERVICE_LAYER');
    expect(slGetRate).toHaveBeenCalledWith('USD', '2026-06-29');

    slGetRate.mockClear();
    hanaGetRate.mockClear();
    const cached = await getSapExchangeRate('USD', '2026-06-29');
    expect(cached.rate).toBe(1450);
    expect(slGetRate).not.toHaveBeenCalled();
    expect(hanaGetRate).not.toHaveBeenCalled();
    expect(buildExchangeRateCacheKey('USD', '2026-06-29')).toBe('USD:2026-06-29');
  });

  it('falls back to HANA ORTT when Service Layer has no rate', async () => {
    slGetRate.mockResolvedValueOnce(null);
    hanaGetRate.mockResolvedValueOnce(1500);
    const result = await getSapExchangeRate('EUR', '2026-06-29');
    expect(result.rate).toBe(1500);
    expect(result.source).toBe('SAP_HANA_ORTT');
  });

  it('throws when SAP has no rate for currency and date', async () => {
    slGetRate.mockResolvedValueOnce(null);
    hanaGetRate.mockResolvedValueOnce(null);
    await expect(getSapExchangeRate('USD', '2026-06-29')).rejects.toMatchObject({
      code: SAP_EXCHANGE_RATE_NOT_FOUND_CODE,
    });
  });

  it('does not request a rate for local currency documents', async () => {
    const result = await resolvePoExchangeRateForDocument({
      currency: 'IQD',
      documentDate: '2026-06-29',
      localCurrency: 'IQD',
    });
    expect(result.docRate).toBeUndefined();
    expect(slGetRate).not.toHaveBeenCalled();
    expect(hanaGetRate).not.toHaveBeenCalled();
  });

  it('requests SAP rate for foreign currency documents', async () => {
    slGetRate.mockResolvedValueOnce(1450);
    const result = await resolvePoExchangeRateForDocument({
      currency: 'USD',
      documentDate: '2026-06-29',
      localCurrency: 'IQD',
    });
    expect(result.docRate).toBe(1450);
    expect(requiresPoDocRate('USD', 'IQD')).toBe(true);
  });

  it('submit blocker flags loading and missing rates', () => {
    expect(
      getPoExchangeRateSubmitBlocker(
        { docCurrency: 'IQD', docRate: '' },
        'IQD',
        { rateLoading: false, rateError: '' },
      ),
    ).toBeNull();

    expect(
      getPoExchangeRateSubmitBlocker(
        { docCurrency: 'USD', docRate: '' },
        'IQD',
        { rateLoading: true, rateError: '' },
        { loading: 'Loading...' },
      ),
    ).toBe('Loading...');

    expect(
      getPoExchangeRateSubmitBlocker(
        { docCurrency: 'USD', docRate: '' },
        'IQD',
        { rateLoading: false, rateError: 'Missing rate' },
      ),
    ).toBe('Missing rate');
  });
});
