import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mergeHeaderWithVendorCurrency } from '@/lib/poCurrency.js';
import {
  clearVendorCurrencyConfigCache,
  loadVendorCurrencyConfigForForm,
} from '@/lib/hooks/useVendorCurrencyConfig.js';

const SINGLE_IQD = {
  vendorCode: 'V000074',
  currencyMode: 'single',
  currency: 'IQD',
  defaultCurrency: 'IQD',
  companyLocalCurrency: 'IQD',
  allowedCurrencies: [{ code: 'IQD', name: 'IQD' }],
};

const MULTI = {
  vendorCode: 'V000096',
  currencyMode: 'all',
  currency: null,
  defaultCurrency: 'IQD',
  companyLocalCurrency: 'IQD',
  allowedCurrencies: [
    { code: 'EUR', name: 'Euro' },
    { code: 'GBP', name: 'British Pound' },
    { code: 'IQD', name: 'Iraqi Dinar' },
    { code: 'USD', name: 'US Dollar' },
  ],
};

describe('mergeHeaderWithVendorCurrency', () => {
  it('returns the same header object when currency fields are unchanged', () => {
    const header = {
      vendor: 'V000096',
      docCurrency: 'IQD',
      docRate: '',
      companyLocalCurrency: 'IQD',
    };
    expect(mergeHeaderWithVendorCurrency(header, MULTI)).toBe(header);
  });

  it('skips default currency update when already selected', () => {
    const header = {
      vendor: 'V000096',
      docCurrency: 'USD',
      docRate: '1350',
      companyLocalCurrency: 'IQD',
    };
    expect(mergeHeaderWithVendorCurrency(header, MULTI)).toBe(header);
  });

  it('applies default currency for a new vendor config', () => {
    const header = { vendor: 'V000096', docCurrency: '', docRate: '' };
    expect(mergeHeaderWithVendorCurrency(header, MULTI)).toEqual({
      vendor: 'V000096',
      docCurrency: 'IQD',
      docRate: '',
      companyLocalCurrency: 'IQD',
    });
  });

  it('preserves single-currency vendor behavior', () => {
    const header = { vendor: 'V000074', docCurrency: '', docRate: '' };
    expect(mergeHeaderWithVendorCurrency(header, SINGLE_IQD)).toEqual({
      vendor: 'V000074',
      docCurrency: 'IQD',
      docRate: '',
      companyLocalCurrency: 'IQD',
    });
  });
});

describe('loadVendorCurrencyConfigForForm', () => {
  beforeEach(() => {
    clearVendorCurrencyConfigCache();
  });

  it('fetches once and serves subsequent loads from cache', async () => {
    const fetchFn = vi.fn().mockResolvedValue(MULTI);
    const cache = new Map();

    await loadVendorCurrencyConfigForForm('V000096', { fetchFn, cache });
    await loadVendorCurrencyConfigForForm('V000096', { fetchFn, cache });

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('does not cache empty invalid configurations', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      vendorCode: 'V000099',
      currencyMode: 'all',
      allowedCurrencies: [],
      error: 'NO_CURRENCIES',
    });
    const cache = new Map();

    await loadVendorCurrencyConfigForForm('V000099', { fetchFn, cache });
    await loadVendorCurrencyConfigForForm('V000099', { fetchFn, cache });

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(cache.size).toBe(0);
  });

  it('ignores aborted responses', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchFn = vi.fn().mockResolvedValue(MULTI);

    const result = await loadVendorCurrencyConfigForForm('V000096', {
      fetchFn,
      signal: controller.signal,
      cache: new Map(),
    });

    expect(result.aborted).toBe(true);
    expect(result.config).toBeNull();
  });

  it('returns cached config without calling fetch', async () => {
    const cache = new Map([['V000074', SINGLE_IQD]]);
    const fetchFn = vi.fn();

    const result = await loadVendorCurrencyConfigForForm('V000074', { fetchFn, cache });

    expect(result.fromCache).toBe(true);
    expect(result.config).toEqual(SINGLE_IQD);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('useVendorCurrencyConfig hook contract', () => {
  const hookSource = fs.readFileSync(
    path.resolve(process.cwd(), 'lib/hooks/useVendorCurrencyConfig.js'),
    'utf8',
  );
  const businessFields = fs.readFileSync(
    path.resolve(process.cwd(), 'components/purchase-orders/PoBusinessFields.jsx'),
    'utf8',
  );

  it('fetch effect depends only on normalized vendor code', () => {
    expect(hookSource).toContain('[normalizedVendorCode]');
    expect(hookSource).not.toMatch(/\[normalizedVendorCode,\s*setHeader/);
    expect(hookSource).not.toContain('header.docCurrency');
    expect(hookSource).toContain('setHeaderRef.current');
  });

  it('uses AbortController and request id guard for stale responses', () => {
    expect(hookSource).toContain('AbortController');
    expect(hookSource).toContain('requestIdRef');
    expect(hookSource).toContain('requestId !== requestIdRef.current');
  });

  it('PoBusinessFields delegates currency fetch to the shared hook', () => {
    expect(businessFields).toContain('useVendorCurrencyConfig');
    expect(businessFields).not.toContain('fetchVendorCurrencyConfig');
    expect(businessFields).toContain('String(header?.vendor || \'\').trim()');
    expect(businessFields).not.toMatch(/useEffect[\s\S]*fetchVendorCurrencyConfig/);
  });
});

describe('PO paths avoid currency fetch loops', () => {
  const sources = [
    'components/purchase-requests/CreatePoFromPrPanel.jsx',
    'components/purchase-requests/ApprovedForPoManager.jsx',
    'components/purchase-orders/PoEditForm.jsx',
  ];

  for (const relativePath of sources) {
    it(`${relativePath} uses shared PoBusinessFields without inline currency fetch`, () => {
      const contents = fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
      expect(contents).toContain('PoBusinessFields');
      expect(contents).not.toContain('fetchVendorCurrencyConfig');
    });
  }
});
