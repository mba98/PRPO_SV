import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  formatPoCurrencyOptionLabel,
  isCurrencyDropdownReadOnly,
  mergeHeaderWithVendorCurrency,
  requiresPoDocRate,
  validatePoDocRateInput,
} from '@/lib/poCurrency.js';
import {
  buildPoAllowedCurrencies,
  normalizeVendorCurrencyConfig,
  validatePoDocCurrencyAndRateForVendor,
  validatePoDocCurrencyForVendor,
} from '@/lib/sap/vendorCurrencies.js';
import { buildCompanyCurrenciesSql } from '@/lib/sap/hanaSql.js';
import { mapPoToSapFromPortalRecord } from '@/lib/sap/mappers/poToSap.js';

const LOCAL = 'IQD';
const SYSTEM = 'USD';

describe('PO currency union — SAP B1 behavior', () => {
  it('IQD BP vendor returns IQD as default', () => {
    const config = normalizeVendorCurrencyConfig({
      vendorCode: 'V000007',
      bpCurrency: 'IQD',
      companyLocalCurrency: LOCAL,
      companySystemCurrency: SYSTEM,
    });
    expect(config.defaultCurrency).toBe('IQD');
    expect(config.bpCurrency).toBe('IQD');
  });

  it('IQD BP vendor also returns company system currency', () => {
    const config = normalizeVendorCurrencyConfig({
      vendorCode: 'V000007',
      bpCurrency: 'IQD',
      companyLocalCurrency: LOCAL,
      companySystemCurrency: SYSTEM,
    });
    expect(config.allowedCurrencies.some((c) => c.code === SYSTEM)).toBe(true);
    expect(config.companySystemCurrency).toBe(SYSTEM);
  });

  it('USD can be selected for an IQD BP vendor', () => {
    const config = normalizeVendorCurrencyConfig({
      vendorCode: 'V000007',
      bpCurrency: 'IQD',
      companyLocalCurrency: LOCAL,
      companySystemCurrency: SYSTEM,
    });
    expect(validatePoDocCurrencyForVendor('USD', config).ok).toBe(true);
  });

  it('multi-currency vendor returns local, system, and CRD13 currencies', () => {
    const config = normalizeVendorCurrencyConfig({
      vendorCode: 'V000096',
      bpCurrency: '##',
      currencyRows: [
        { currencyCode: 'EUR', included: 'Y', locked: 'N', currencyName: 'Euro' },
        { currencyCode: 'GBP', included: 'Y', locked: 'N', currencyName: 'British Pound' },
        { currencyCode: 'IQD', included: 'Y', locked: 'Y', currencyName: 'Iraqi Dinar' },
        { currencyCode: 'USD', included: 'Y', locked: 'N', currencyName: 'US Dollar' },
      ],
      companyLocalCurrency: LOCAL,
      companySystemCurrency: SYSTEM,
    });
    const codes = config.allowedCurrencies.map((c) => c.code);
    expect(codes).toEqual(expect.arrayContaining(['EUR', 'GBP', LOCAL, SYSTEM]));
  });

  it('deduplicates currency codes with merged sources', () => {
    const entries = buildPoAllowedCurrencies({
      companyLocalCurrency: LOCAL,
      companySystemCurrency: SYSTEM,
      bpCurrency: LOCAL,
    });
    expect(entries.filter((e) => e.code === LOCAL)).toHaveLength(1);
    expect(entries.find((e) => e.code === LOCAL).sources.sort()).toEqual(['bp', 'local']);
  });

  it('formats currency source labels for dropdown display', () => {
    const label = formatPoCurrencyOptionLabel(
      { code: 'IQD', sources: ['local', 'bp'] },
      { local: 'Local Currency', bp: 'BP Currency' },
    );
    expect(label).toBe('IQD — Local Currency / BP Currency');
  });

  it('dropdown stays enabled for single BP-currency vendor with system currency', () => {
    const config = normalizeVendorCurrencyConfig({
      vendorCode: 'V1',
      bpCurrency: 'IQD',
      companyLocalCurrency: LOCAL,
      companySystemCurrency: SYSTEM,
    });
    expect(isCurrencyDropdownReadOnly(config)).toBe(false);
  });

  it('vendor default remains preselected on new vendor', () => {
    const config = normalizeVendorCurrencyConfig({
      vendorCode: 'V1',
      bpCurrency: 'IQD',
      companyLocalCurrency: LOCAL,
      companySystemCurrency: SYSTEM,
    });
    expect(
      mergeHeaderWithVendorCurrency({ vendor: 'V1', docCurrency: '', docRate: '' }, config),
    ).toMatchObject({ docCurrency: 'IQD', docRate: '' });
  });

  it('user currency selection is preserved when still allowed', () => {
    const config = normalizeVendorCurrencyConfig({
      vendorCode: 'V1',
      bpCurrency: 'IQD',
      companyLocalCurrency: LOCAL,
      companySystemCurrency: SYSTEM,
    });
    const header = {
      vendor: 'V1',
      docCurrency: 'USD',
      docRate: '1450',
      companyLocalCurrency: LOCAL,
      companySystemCurrency: SYSTEM,
    };
    expect(mergeHeaderWithVendorCurrency(header, config)).toBe(header);
  });

  it('local currency does not require DocRate', () => {
    expect(requiresPoDocRate(LOCAL, LOCAL)).toBe(false);
    expect(validatePoDocRateInput(LOCAL, null, LOCAL).ok).toBe(true);
  });

  it('system currency requires positive DocRate when different from local', () => {
    expect(requiresPoDocRate(SYSTEM, LOCAL)).toBe(true);
    expect(validatePoDocRateInput(SYSTEM, 1450, LOCAL).ok).toBe(true);
    expect(validatePoDocRateInput(SYSTEM, '', LOCAL).ok).toBe(false);
  });

  it('backend accepts USD for IQD BP vendor when USD is system currency', () => {
    const config = normalizeVendorCurrencyConfig({
      vendorCode: 'V1',
      bpCurrency: 'IQD',
      companyLocalCurrency: LOCAL,
      companySystemCurrency: SYSTEM,
    });
    expect(validatePoDocCurrencyAndRateForVendor('USD', 1450, config).ok).toBe(true);
  });

  it('backend rejects currency outside local/system/BP union', () => {
    const config = normalizeVendorCurrencyConfig({
      vendorCode: 'V1',
      bpCurrency: 'IQD',
      companyLocalCurrency: LOCAL,
      companySystemCurrency: SYSTEM,
    });
    expect(validatePoDocCurrencyForVendor('EUR', config).ok).toBe(false);
  });

  it('SAP payload preserves selected USD currency and DocRate', () => {
    const payload = mapPoToSapFromPortalRecord(
      {
        vendor: 'V000007',
        docCurrency: SYSTEM,
        docRate: 1450,
        documentDate: new Date('2026-06-01'),
        dueDate: new Date('2026-06-02'),
        lines: [
          {
            itemCode: 'A1',
            quantity: 1,
            unitPrice: 10,
            uomCode: 'PCS',
            warehouseCode: 'WH1',
          },
        ],
      },
      {},
      { localCurrency: LOCAL },
    );
    expect(payload.DocCurrency).toBe('USD');
    expect(payload.DocRate).toBe(1450);
  });

  it('never exposes ## in allowed currencies', () => {
    const config = normalizeVendorCurrencyConfig({
      vendorCode: 'V000017',
      bpCurrency: '##',
      currencyRows: [{ CurrencyCode: '##', Include: 'Y' }],
      companyLocalCurrency: LOCAL,
      companySystemCurrency: SYSTEM,
    });
    expect(config.allowedCurrencies.every((c) => c.code !== '##')).toBe(true);
  });

  it('OADM SQL selects local and system currency columns', () => {
    const sql = buildCompanyCurrenciesSql('SBO_COMPANY');
    expect(sql).toContain('"MainCurncy"');
    expect(sql).toContain('"SysCurrncy"');
    expect(sql).toContain('"localCurrency"');
    expect(sql).toContain('"systemCurrency"');
  });

  it('PoBusinessFields does not disable currency for single BP mode', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'lib/poCurrency.js'),
      'utf8',
    );
    expect(src).not.toContain("currencyMode === 'single'");
  });

  it('useVendorCurrencyConfig fetch depends only on vendor code', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'lib/hooks/useVendorCurrencyConfig.js'),
      'utf8',
    );
    expect(src).toContain('[normalizedVendorCode]');
    expect(src).not.toContain('header.docCurrency');
  });
});
