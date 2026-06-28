import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SAP_ALL_CURRENCIES_TOKEN,
  extractBpCurrencyCollection,
  isSapAllCurrenciesToken,
  normalizeCurrencyCode,
  normalizeVendorCurrencyConfig,
  validatePoDocCurrencyForVendor,
} from '@/lib/sap/vendorCurrencies.js';

describe('vendorCurrencies normalization', () => {
  it('treats ## as all-currencies token', () => {
    expect(isSapAllCurrenciesToken('##')).toBe(true);
    expect(normalizeCurrencyCode('##')).toBeNull();
  });

  it('normalizes single-currency vendor', () => {
    const config = normalizeVendorCurrencyConfig({
      vendorCode: 'V000001',
      vendorName: 'Vendor Name',
      bpCurrency: 'USD',
      currencyRows: [],
    });
    expect(config).toEqual({
      vendorCode: 'V000001',
      vendorName: 'Vendor Name',
      currencyMode: 'single',
      currency: 'USD',
      defaultCurrency: 'USD',
      allowedCurrencies: [{ code: 'USD', name: 'USD' }],
    });
  });

  it('never exposes ## as an allowed document currency', () => {
    const config = normalizeVendorCurrencyConfig({
      vendorCode: 'V000017',
      vendorName: 'Vendor Name',
      bpCurrency: SAP_ALL_CURRENCIES_TOKEN,
      currencyRows: [
        { CurrencyCode: '##', Include: 'tYES', Default: 'tNO' },
        { CurrencyCode: 'IQD', Include: 'tYES', Default: 'tYES', CurrencyName: 'Iraqi Dinar' },
        { CurrencyCode: 'USD', Include: 'tYES', Default: 'tNO', CurrencyName: 'US Dollar' },
        { CurrencyCode: 'EUR', Include: 'tNO', Default: 'tNO' },
      ],
      companyLocalCurrency: 'IQD',
    });
    expect(config.currencyMode).toBe('all');
    expect(config.currency).toBeNull();
    expect(config.defaultCurrency).toBe('IQD');
    expect(config.allowedCurrencies.map((c) => c.code)).toEqual(['IQD', 'USD']);
  });

  it('picks SAP default currency for all-currencies vendor', () => {
    const config = normalizeVendorCurrencyConfig({
      vendorCode: 'V000017',
      bpCurrency: '##',
      currencyRows: [
        { CurrencyCode: 'IQD', Include: 'Y', Default: 'Y' },
        { CurrencyCode: 'USD', Include: 'Y', Default: 'N' },
      ],
      companyLocalCurrency: 'IQD',
    });
    expect(config.defaultCurrency).toBe('IQD');
  });

  it('extracts BPCurrenciesCollection from Service Layer payload', () => {
    const rows = extractBpCurrencyCollection({
      BPCurrenciesCollection: [{ CurrencyCode: 'USD' }],
    });
    expect(rows).toHaveLength(1);
  });

  it('validates submitted currency against vendor config', () => {
    const single = normalizeVendorCurrencyConfig({
      vendorCode: 'V1',
      bpCurrency: 'USD',
    });
    expect(validatePoDocCurrencyForVendor('USD', single).ok).toBe(true);
    expect(validatePoDocCurrencyForVendor('IQD', single).ok).toBe(false);
    expect(validatePoDocCurrencyForVendor('##', single).ok).toBe(false);

    const all = normalizeVendorCurrencyConfig({
      vendorCode: 'V2',
      bpCurrency: '##',
      currencyRows: [
        { CurrencyCode: 'IQD', Include: 'Y' },
        { CurrencyCode: 'USD', Include: 'Y', Default: 'Y' },
      ],
      companyLocalCurrency: 'IQD',
    });
    expect(validatePoDocCurrencyForVendor('IQD', all).ok).toBe(true);
    expect(validatePoDocCurrencyForVendor('USD', all).ok).toBe(true);
    expect(validatePoDocCurrencyForVendor('EUR', all).ok).toBe(false);
  });
});

describe('applyVendorCurrencyConfigToHeader', () => {
  it('keeps current currency when allowed by new vendor', async () => {
    const { applyVendorCurrencyConfigToHeader } = await import('@/lib/poCurrency.js');
    const config = normalizeVendorCurrencyConfig({
      vendorCode: 'V2',
      bpCurrency: '##',
      currencyRows: [
        { CurrencyCode: 'IQD', Include: 'Y' },
        { CurrencyCode: 'USD', Include: 'Y', Default: 'Y' },
      ],
    });
    expect(
      applyVendorCurrencyConfigToHeader(config, { docCurrency: 'IQD', docRate: '' }),
    ).toEqual({ docCurrency: 'IQD', docRate: '' });
  });

  it('switches to vendor default when current currency is not allowed', async () => {
    const { applyVendorCurrencyConfigToHeader } = await import('@/lib/poCurrency.js');
    const config = normalizeVendorCurrencyConfig({
      vendorCode: 'V2',
      bpCurrency: '##',
      currencyRows: [
        { CurrencyCode: 'IQD', Include: 'Y', Default: 'Y' },
        { CurrencyCode: 'USD', Include: 'Y' },
      ],
      companyLocalCurrency: 'IQD',
    });
    expect(
      applyVendorCurrencyConfigToHeader(config, { docCurrency: 'EUR', docRate: '' }),
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
