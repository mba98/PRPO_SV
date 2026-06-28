import { describe, expect, it } from 'vitest';
import {
  applyCurrencyChangeToHeader,
  applyVendorCurrencyConfigToHeader,
  applyVendorCurrencyToHeader,
  isBlockedSapCurrencyToken,
  isLocalPoCurrency,
  mergeHeaderWithVendorCurrency,
  normalizePoDocCurrency,
  normalizePoDocRateForStorage,
  requiresPoDocRate,
  resolveFormDocRateFromPo,
  resolveFormDocCurrencyFromPo,
  validatePoDocRateInput,
} from '@/lib/poCurrency.js';
import { normalizeVendorCurrencyConfig } from '@/lib/sap/vendorCurrencies.js';

const LOCAL = 'IQD';

describe('poCurrency', () => {
  it('normalizes doc currency and rejects ##', () => {
    expect(normalizePoDocCurrency('iqd')).toBe('IQD');
    expect(normalizePoDocCurrency('usd')).toBe('USD');
    expect(normalizePoDocCurrency('EUR', 'IQD')).toBe('EUR');
    expect(normalizePoDocCurrency('##', 'IQD')).toBe('IQD');
    expect(normalizePoDocCurrency('', 'USD')).toBe('USD');
    expect(isBlockedSapCurrencyToken('##')).toBe(true);
  });

  it('identifies local versus foreign currencies', () => {
    expect(isLocalPoCurrency('IQD', LOCAL)).toBe(true);
    expect(isLocalPoCurrency('USD', LOCAL)).toBe(false);
    expect(requiresPoDocRate('USD', LOCAL)).toBe(true);
    expect(requiresPoDocRate('EUR', LOCAL)).toBe(true);
    expect(requiresPoDocRate('GBP', LOCAL)).toBe(true);
    expect(requiresPoDocRate('IQD', LOCAL)).toBe(false);
  });

  it('stores docRate only for foreign currencies', () => {
    expect(normalizePoDocRateForStorage('USD', 1400, LOCAL)).toBe(1400);
    expect(normalizePoDocRateForStorage('EUR', 1500, LOCAL)).toBe(1500);
    expect(normalizePoDocRateForStorage('USD', '', LOCAL)).toBeUndefined();
    expect(normalizePoDocRateForStorage('IQD', 1350, LOCAL)).toBeUndefined();
  });

  it('validates foreign DocRate input', () => {
    expect(validatePoDocRateInput('IQD', null, LOCAL).ok).toBe(true);
    expect(validatePoDocRateInput('USD', 1350, LOCAL).ok).toBe(true);
    expect(validatePoDocRateInput('EUR', 1500, LOCAL).ok).toBe(true);
    expect(validatePoDocRateInput('USD', '', LOCAL).ok).toBe(false);
    expect(validatePoDocRateInput('GBP', 0, LOCAL).ok).toBe(false);
  });

  it('preserves saved PO currency and rate in form helpers', () => {
    expect(resolveFormDocCurrencyFromPo({ docCurrency: 'IQD' })).toBe('IQD');
    expect(resolveFormDocRateFromPo({ docCurrency: 'USD', docRate: 1200 }, LOCAL)).toBe('1200');
    expect(resolveFormDocRateFromPo({ docCurrency: 'EUR', docRate: 1500 }, LOCAL)).toBe('1500');
    expect(resolveFormDocRateFromPo({ docCurrency: 'IQD', docRate: 1350 }, LOCAL)).toBe('');
  });

  it('clears rate when currency changes to local currency', () => {
    expect(
      applyCurrencyChangeToHeader('IQD', { docCurrency: 'USD', docRate: '1350' }, LOCAL),
    ).toEqual({ docCurrency: 'IQD', docRate: '' });
  });

  it('clears rate when switching between foreign currencies', () => {
    expect(
      applyCurrencyChangeToHeader('EUR', { docCurrency: 'USD', docRate: '1350' }, LOCAL),
    ).toEqual({ docCurrency: 'EUR', docRate: '' });
    expect(
      applyCurrencyChangeToHeader('GBP', { docCurrency: 'EUR', docRate: '1500' }, LOCAL),
    ).toEqual({ docCurrency: 'GBP', docRate: '' });
  });

  it('does not auto-fill foreign rate when selecting USD from local', () => {
    expect(
      applyCurrencyChangeToHeader('USD', { docCurrency: 'IQD', docRate: '' }, LOCAL),
    ).toEqual({ docCurrency: 'USD', docRate: '' });
  });

  it('applies vendor currency config with allowed list', () => {
    const config = normalizeVendorCurrencyConfig({
      vendorCode: 'V000018',
      bpCurrency: '##',
      currencyRows: [
        { currencyCode: 'IQD', included: 'Y', locked: 'Y', currencyName: 'Iraqi Dinar' },
        { currencyCode: 'USD', included: 'Y', locked: 'N', currencyName: 'US Dollar' },
        { currencyCode: 'EUR', included: 'Y', locked: 'N', currencyName: 'Euro' },
      ],
      companyLocalCurrency: LOCAL,
    });
    expect(applyVendorCurrencyConfigToHeader(config, {})).toEqual({
      docCurrency: 'IQD',
      docRate: '',
    });
  });

  it('defers ## vendor currency until SAP config loads', () => {
    expect(
      applyVendorCurrencyToHeader({ currency: '##' }, { docCurrency: 'USD', docRate: '1200' }, LOCAL),
    ).toEqual({ docCurrency: 'USD', docRate: '1200' });
  });

  it('mergeHeaderWithVendorCurrency is a no-op when docCurrency and docRate unchanged', () => {
    const header = { docCurrency: 'USD', docRate: '1400', companyLocalCurrency: LOCAL };
    const config = normalizeVendorCurrencyConfig({
      vendorCode: 'V000001',
      bpCurrency: 'USD',
      companyLocalCurrency: LOCAL,
    });
    expect(mergeHeaderWithVendorCurrency(header, config)).toBe(header);
  });
});
