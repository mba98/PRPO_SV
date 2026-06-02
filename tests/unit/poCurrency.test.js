import { describe, expect, it } from 'vitest';
import {
  applyCurrencyChangeToHeader,
  applyVendorCurrencyToHeader,
  normalizePoDocCurrency,
  normalizePoDocRateForStorage,
  resolveFormDocRateFromPo,
  resolveFormDocCurrencyFromPo,
} from '@/lib/poCurrency.js';
import { DEV_DEFAULT_PO_DOC_RATE } from '@/lib/sap/sapPoConfig.js';

describe('poCurrency', () => {
  it('normalizes doc currency to USD or IQD', () => {
    expect(normalizePoDocCurrency('iqd')).toBe('IQD');
    expect(normalizePoDocCurrency('usd')).toBe('USD');
    expect(normalizePoDocCurrency('EUR', 'IQD')).toBe('IQD');
    expect(normalizePoDocCurrency('', 'USD')).toBe('USD');
  });

  it('stores docRate only for USD', () => {
    expect(normalizePoDocRateForStorage('USD', 1400)).toBe(1400);
    expect(normalizePoDocRateForStorage('USD', '')).toBeUndefined();
    expect(normalizePoDocRateForStorage('USD', null)).toBeUndefined();
    expect(normalizePoDocRateForStorage('IQD', 1350)).toBeUndefined();
  });

  it('defaults USD docRate in form when PO has no saved rate', () => {
    expect(resolveFormDocRateFromPo({ docCurrency: 'USD' })).toBe(String(DEV_DEFAULT_PO_DOC_RATE));
    expect(resolveFormDocRateFromPo({ docCurrency: 'IQD', docRate: 1350 })).toBe('');
  });

  it('preserves saved PO currency and rate in form helpers', () => {
    expect(resolveFormDocCurrencyFromPo({ docCurrency: 'IQD' })).toBe('IQD');
    expect(resolveFormDocRateFromPo({ docCurrency: 'USD', docRate: 1200 })).toBe('1200');
  });

  it('prefills from vendor currency and defaults USD rate to 1350', () => {
    expect(applyVendorCurrencyToHeader({ currency: 'IQD' }, {})).toEqual({
      docCurrency: 'IQD',
      docRate: '',
    });
    expect(applyVendorCurrencyToHeader({ currency: 'USD' }, {})).toEqual({
      docCurrency: 'USD',
      docRate: String(DEV_DEFAULT_PO_DOC_RATE),
    });
  });

  it('does not overwrite user rate when switching vendor unless USD rate empty', () => {
    expect(
      applyVendorCurrencyToHeader({ currency: 'USD' }, { docCurrency: 'USD', docRate: '1200' }),
    ).toEqual({ docCurrency: 'USD', docRate: '1200' });
  });

  it('clears rate when currency changes to IQD', () => {
    expect(applyCurrencyChangeToHeader('IQD', { docCurrency: 'USD', docRate: '1350' })).toEqual({
      docCurrency: 'IQD',
      docRate: '',
    });
  });

  it('fills default rate when currency changes to USD with empty rate', () => {
    expect(applyCurrencyChangeToHeader('USD', { docCurrency: 'IQD', docRate: '' })).toEqual({
      docCurrency: 'USD',
      docRate: String(DEV_DEFAULT_PO_DOC_RATE),
    });
  });
});
