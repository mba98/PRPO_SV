import { describe, expect, it, vi, beforeEach } from 'vitest';
import { clearLookupCache } from '@/lib/sapLookupCache.js';
import {
  SAP_ALL_CURRENCIES_TOKEN,
  extractBpCurrencyCollection,
  isSapAllCurrenciesToken,
  normalizeCurrencyCode,
  normalizeVendorCurrencyConfig,
  readField,
  validatePoDocCurrencyAndRateForVendor,
  validatePoDocCurrencyForVendor,
} from '@/lib/sap/vendorCurrencies.js';

const V000018_HANA_ROWS = [
  { currencyCode: 'EUR', included: 'Y', locked: 'N', currencyName: 'Euro', BpCurrency: '##' },
  { currencyCode: 'GBP', included: 'Y', locked: 'N', currencyName: 'British Pound', BpCurrency: '##' },
  { currencyCode: 'IQD', included: 'Y', locked: 'Y', currencyName: 'Iraqi Dinar', BpCurrency: '##' },
  { currencyCode: 'USD', included: 'Y', locked: 'N', currencyName: 'US Dollar', BpCurrency: '##' },
];

describe('vendorCurrencies normalization', () => {
  it('treats ## as all-currencies token', () => {
    expect(isSapAllCurrenciesToken('##')).toBe(true);
    expect(normalizeCurrencyCode('##')).toBeNull();
  });

  it('normalizes single-currency vendor from OCRD header', () => {
    expect(
      normalizeVendorCurrencyConfig({
        vendorCode: 'V000001',
        bpCurrency: 'USD',
        currencyRows: [],
        companyLocalCurrency: 'IQD',
      }),
    ).toMatchObject({
      currencyMode: 'single',
      defaultCurrency: 'USD',
      allowedCurrencies: [{ code: 'USD', name: 'USD' }],
      companyLocalCurrency: 'IQD',
    });
  });

  it('returns IQD only for single-currency IQD vendor', () => {
    const config = normalizeVendorCurrencyConfig({
      vendorCode: 'V000002',
      bpCurrency: 'IQD',
      companyLocalCurrency: 'IQD',
    });
    expect(config.allowedCurrencies.map((c) => c.code)).toEqual(['IQD']);
  });

  it('loads multi-currency vendor rows from CRD13 with INCLUDE = Y', () => {
    const config = normalizeVendorCurrencyConfig({
      vendorCode: 'V000018',
      bpCurrency: SAP_ALL_CURRENCIES_TOKEN,
      currencyRows: V000018_HANA_ROWS,
      companyLocalCurrency: 'IQD',
    });
    expect(config.currencyMode).toBe('all');
    expect(config.allowedCurrencies.map((c) => c.code)).toEqual(['EUR', 'GBP', 'IQD', 'USD']);
    expect(config.allowedCurrencies.find((c) => c.code === 'IQD')?.name).toBe('Iraqi Dinar');
  });

  it('does not remove Locked = Y currencies such as IQD', () => {
    const config = normalizeVendorCurrencyConfig({
      vendorCode: 'V000018',
      bpCurrency: '##',
      currencyRows: V000018_HANA_ROWS,
      companyLocalCurrency: 'IQD',
    });
    expect(config.allowedCurrencies.some((c) => c.code === 'IQD')).toBe(true);
  });

  it('uses Locked = Y as default currency for V000018', () => {
    const config = normalizeVendorCurrencyConfig({
      vendorCode: 'V000018',
      bpCurrency: '##',
      currencyRows: V000018_HANA_ROWS,
      companyLocalCurrency: 'IQD',
    });
    expect(config.defaultCurrency).toBe('IQD');
  });

  it('never exposes ## as an allowed document currency', () => {
    const config = normalizeVendorCurrencyConfig({
      vendorCode: 'V000017',
      bpCurrency: SAP_ALL_CURRENCIES_TOKEN,
      currencyRows: [
        { CurrencyCode: '##', Include: 'Y', Locked: 'N' },
        { CurrencyCode: 'IQD', Include: 'Y', Locked: 'Y', CurrencyName: 'Iraqi Dinar' },
        { CurrencyCode: 'USD', Include: 'Y', Locked: 'N', CurrencyName: 'US Dollar' },
        { CurrencyCode: 'EUR', Include: 'N', Locked: 'N' },
      ],
      companyLocalCurrency: 'IQD',
    });
    expect(config.allowedCurrencies.map((c) => c.code)).toEqual(['IQD', 'USD']);
  });

  it('deduplicates duplicate CRD13 currency rows', () => {
    const config = normalizeVendorCurrencyConfig({
      vendorCode: 'V000018',
      bpCurrency: '##',
      currencyRows: [
        ...V000018_HANA_ROWS,
        { currencyCode: 'USD', included: 'Y', locked: 'N', currencyName: 'US Dollar', BpCurrency: '##' },
      ],
      companyLocalCurrency: 'IQD',
    });
    expect(config.allowedCurrencies.filter((c) => c.code === 'USD')).toHaveLength(1);
  });

  it('extracts BPCurrenciesCollection from Service Layer payload', () => {
    const rows = extractBpCurrencyCollection({
      BPCurrenciesCollection: [{ CurrencyCode: 'USD', Include: 'Y' }],
    });
    expect(rows).toHaveLength(1);
  });

  it('validates submitted currency against vendor config', () => {
    const single = normalizeVendorCurrencyConfig({
      vendorCode: 'V1',
      bpCurrency: 'USD',
      companyLocalCurrency: 'IQD',
    });
    expect(validatePoDocCurrencyForVendor('USD', single).ok).toBe(true);
    expect(validatePoDocCurrencyForVendor('IQD', single).ok).toBe(false);
    expect(validatePoDocCurrencyForVendor('##', single).ok).toBe(false);

    const all = normalizeVendorCurrencyConfig({
      vendorCode: 'V000018',
      bpCurrency: '##',
      currencyRows: V000018_HANA_ROWS,
      companyLocalCurrency: 'IQD',
    });
    expect(validatePoDocCurrencyForVendor('EUR', all).ok).toBe(true);
    expect(validatePoDocCurrencyForVendor('GBP', all).ok).toBe(true);
    expect(validatePoDocCurrencyForVendor('CHF', all).ok).toBe(false);
  });

  it('validates foreign DocRate and local-currency omission', () => {
    const config = normalizeVendorCurrencyConfig({
      vendorCode: 'V000018',
      bpCurrency: '##',
      currencyRows: V000018_HANA_ROWS,
      companyLocalCurrency: 'IQD',
    });
    expect(validatePoDocCurrencyAndRateForVendor('IQD', null, config).ok).toBe(true);
    expect(validatePoDocCurrencyAndRateForVendor('USD', 1350, config).ok).toBe(true);
    expect(validatePoDocCurrencyAndRateForVendor('EUR', 1500, config).ok).toBe(true);
    expect(validatePoDocCurrencyAndRateForVendor('USD', '', config).ok).toBe(false);
    expect(validatePoDocCurrencyAndRateForVendor('EUR', 0, config).ok).toBe(false);
  });

  it('returns NO_CURRENCIES when multi-currency vendor has no included rows', () => {
    const config = normalizeVendorCurrencyConfig({
      vendorCode: 'V000099',
      bpCurrency: '##',
      currencyRows: [],
      companyLocalCurrency: 'IQD',
    });
    expect(config.error).toBe('NO_CURRENCIES');
    expect(config.allowedCurrencies).toEqual([]);
  });
});

describe('readField ODBC aliases', () => {
  it('reads lowercase camelCase aliases', () => {
    expect(readField({ currencyCode: 'USD' }, 'currencyCode')).toBe('USD');
    expect(readField({ included: 'Y' }, 'included')).toBe('Y');
    expect(readField({ locked: 'N' }, 'locked')).toBe('N');
  });

  it('reads uppercase ODBC aliases', () => {
    expect(readField({ CURRENCYCODE: 'EUR' }, 'currencyCode')).toBe('EUR');
    expect(readField({ INCLUDE: 'Y' }, 'INCLUDE')).toBe('Y');
    expect(readField({ LOCKED: 'Y' }, 'locked')).toBe('Y');
  });

  it('maps uppercase ODBC CRD13 rows through normalizeIncludedFlag', () => {
    const row = { CURRENCYCODE: 'USD', INCLUDE: 'Y', LOCKED: 'N', CURRENCYNAME: 'US Dollar' };
    expect(
      normalizeVendorCurrencyConfig({
        vendorCode: 'V000096',
        bpCurrency: '##',
        currencyRows: [row],
        companyLocalCurrency: 'IQD',
      }).allowedCurrencies,
    ).toEqual([{ code: 'USD', name: 'US Dollar' }]);
  });
});

describe('getVendorCurrencyConfig ## fallback', () => {
  beforeEach(() => {
    clearLookupCache();
    vi.resetModules();
  });

  it('returns single-currency Service Layer result without HANA', async () => {
    vi.doMock('@/lib/sapServiceLayer.js', () => ({
      getBusinessPartner: vi.fn().mockResolvedValue({
        CardCode: 'V000074',
        CardName: 'Vendor IQD',
        Currency: 'IQD',
      }),
    }));
    vi.doMock('@/lib/sapHana.js', () => ({
      listVendorCrd13CurrencyRows: vi.fn(),
      getVendorHeaderFromHana: vi.fn(),
      getCompanyLocalCurrency: vi.fn().mockResolvedValue('IQD'),
    }));

    const { getVendorCurrencyConfig } = await import('@/lib/sap/vendorCurrencies.js');
    const hana = await import('@/lib/sapHana.js');

    const config = await getVendorCurrencyConfig('V000074');
    expect(config.currencyMode).toBe('single');
    expect(config.defaultCurrency).toBe('IQD');
    expect(hana.listVendorCrd13CurrencyRows).not.toHaveBeenCalled();
  });

  it('falls back to CRD13 when Service Layer collection is empty for ## vendor', async () => {
    vi.doMock('@/lib/sapServiceLayer.js', () => ({
      getBusinessPartner: vi.fn().mockResolvedValue({
        CardCode: 'V000096',
        CardName: 'Multi Vendor',
        Currency: '##',
        BPCurrenciesCollection: [],
      }),
    }));
    vi.doMock('@/lib/sapHana.js', () => ({
      getCompanyLocalCurrency: vi.fn().mockResolvedValue('IQD'),
      getVendorHeaderFromHana: vi.fn().mockResolvedValue({
        cardCode: 'V000096',
        cardName: 'Multi Vendor',
        bpCurrency: '##',
      }),
      listVendorCrd13CurrencyRows: vi.fn().mockResolvedValue(V000018_HANA_ROWS),
    }));

    const { getVendorCurrencyConfig } = await import('@/lib/sap/vendorCurrencies.js');
    const config = await getVendorCurrencyConfig('V000096');
    expect(config.currencyMode).toBe('all');
    expect(config.allowedCurrencies.map((c) => c.code)).toEqual(['EUR', 'GBP', 'IQD', 'USD']);
    expect(config.defaultCurrency).toBe('IQD');
  });

  it('returns 503 only when Service Layer and HANA both fail', async () => {
    vi.doMock('@/lib/sapServiceLayer.js', () => ({
      getBusinessPartner: vi.fn().mockRejectedValue(new Error('SL unavailable')),
    }));
    vi.doMock('@/lib/sapHana.js', () => ({
      getCompanyLocalCurrency: vi.fn().mockResolvedValue('IQD'),
      getVendorHeaderFromHana: vi.fn().mockResolvedValue({
        cardCode: 'V000096',
        bpCurrency: '##',
      }),
      listVendorCrd13CurrencyRows: vi.fn().mockRejectedValue(new Error('CRD13 query failed')),
    }));

    const { getVendorCurrencyConfig } = await import('@/lib/sap/vendorCurrencies.js');
    await expect(getVendorCurrencyConfig('V000096')).rejects.toMatchObject({
      code: 'VENDOR_CURRENCY_CONFIG',
      message: 'Failed to load Vendor currencies from SAP.',
    });
  });
});

describe('applyVendorCurrencyConfigToHeader', () => {
  it('keeps current currency when allowed by new vendor', async () => {
    const { applyVendorCurrencyConfigToHeader } = await import('@/lib/poCurrency.js');
    const config = normalizeVendorCurrencyConfig({
      vendorCode: 'V000018',
      bpCurrency: '##',
      currencyRows: V000018_HANA_ROWS,
      companyLocalCurrency: 'IQD',
    });
    expect(
      applyVendorCurrencyConfigToHeader(config, { docCurrency: 'USD', docRate: '1350' }),
    ).toEqual({ docCurrency: 'USD', docRate: '1350' });
  });

  it('clears foreign rate when switching between foreign currencies', async () => {
    const { applyCurrencyChangeToHeader } = await import('@/lib/poCurrency.js');
    expect(
      applyCurrencyChangeToHeader(
        'EUR',
        { docCurrency: 'USD', docRate: '1350' },
        'IQD',
      ),
    ).toEqual({ docCurrency: 'EUR', docRate: '' });
  });

  it('switches to vendor default when current currency is not allowed', async () => {
    const { applyVendorCurrencyConfigToHeader } = await import('@/lib/poCurrency.js');
    const config = normalizeVendorCurrencyConfig({
      vendorCode: 'V000018',
      bpCurrency: '##',
      currencyRows: V000018_HANA_ROWS,
      companyLocalCurrency: 'IQD',
    });
    expect(
      applyVendorCurrencyConfigToHeader(config, { docCurrency: 'CHF', docRate: '999' }),
    ).toEqual({ docCurrency: 'IQD', docRate: '' });
  });
});

describe('mapVendorRow list currency', () => {
  it('omits ## from vendor list currency', async () => {
    const { mapVendorRow } = await import('@/lib/sapLookups.js');
    expect(mapVendorRow({ CardCode: 'V1', Currency: '##' }).currency).toBeUndefined();
    expect(mapVendorRow({ CardCode: 'V2', Currency: 'USD' }).currency).toBe('USD');
  });
});
