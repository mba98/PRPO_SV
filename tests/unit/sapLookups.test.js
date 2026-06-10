import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  mapVendorRow,
  mapWarehouseRow,
  mapProjectRow,
  mapCostCenterRow,
  searchSapWarehouses,
} from '@/lib/sapLookups';
import { clearLookupCache } from '@/lib/sapLookupCache';

vi.mock('@/lib/sapServiceLayer.js', () => ({
  getVendors: vi.fn(),
  getWarehouses: vi.fn(),
  getProjects: vi.fn(),
  getCostCenters: vi.fn(),
}));

import { getWarehouses } from '@/lib/sapServiceLayer.js';

describe('sapLookups normalization', () => {
  it('maps vendor row', () => {
    expect(
      mapVendorRow({
        CardCode: 'V001',
        CardName: 'Acme',
        Currency: 'USD',
        Phone1: '555',
        E_Mail: 'a@b.com',
      }),
    ).toEqual({
      cardCode: 'V001',
      cardName: 'Acme',
      currency: 'USD',
      phone: '555',
      email: 'a@b.com',
    });
  });

  it('maps vendor currency from CardCurrency or DocCurrency', () => {
    expect(mapVendorRow({ CardCode: 'V2', CardCurrency: 'IQD' }).currency).toBe('IQD');
    expect(mapVendorRow({ CardCode: 'V3', DocCurrency: 'usd' }).currency).toBe('USD');
  });

  it('maps warehouse row from Service Layer fields', () => {
    expect(mapWarehouseRow({ WarehouseCode: 'RAN001', WarehouseName: 'Main' })).toEqual({
      value: 'RAN001',
      label: 'Main',
      code: 'RAN001',
      warehouseCode: 'RAN001',
      warehouseName: 'Main',
    });
  });

  it('falls back to HANA OWHS field names for warehouse row', () => {
    expect(mapWarehouseRow({ WhsCode: '01', WhsName: 'Legacy' })).toEqual({
      value: '01',
      label: 'Legacy',
      code: '01',
      warehouseCode: '01',
      warehouseName: 'Legacy',
    });
  });

  it('maps project row', () => {
    expect(mapProjectRow({ Code: 'P1', Name: 'Project 1' })).toEqual({
      value: 'P1',
      label: 'Project 1',
      code: 'P1',
      projectCode: 'P1',
      projectName: 'Project 1',
    });
  });

  it('maps cost center row', () => {
    expect(
      mapCostCenterRow({ FactorCode: 'CC1', FactorDescription: 'Ops', InWhichDimension: 1 }),
    ).toEqual({
      code: 'CC1',
      name: 'Ops',
      dimension: 1,
    });
  });
});

describe('searchSapWarehouses', () => {
  beforeEach(() => {
    clearLookupCache();
    getWarehouses.mockReset();
  });

  it('unwraps { value: [...] } and normalizes', async () => {
    getWarehouses.mockResolvedValue({
      value: [{ WarehouseCode: 'WH1', WarehouseName: 'Main' }],
    });
    expect(await searchSapWarehouses('')).toEqual([
      {
        value: 'WH1',
        label: 'Main',
        code: 'WH1',
        warehouseCode: 'WH1',
        warehouseName: 'Main',
      },
    ]);
  });

  it('handles a direct array payload (already unwrapped)', async () => {
    getWarehouses.mockResolvedValue([{ WarehouseCode: 'WH2', WarehouseName: 'Spare' }]);
    expect(await searchSapWarehouses('spare')).toEqual([
      {
        value: 'WH2',
        label: 'Spare',
        code: 'WH2',
        warehouseCode: 'WH2',
        warehouseName: 'Spare',
      },
    ]);
  });

  it('returns [] when no record matches the query', async () => {
    getWarehouses.mockResolvedValue({
      value: [{ WarehouseCode: 'WH1', WarehouseName: 'Main' }],
    });
    expect(await searchSapWarehouses('nomatch')).toEqual([]);
  });

  it('serves cached rows without a second SAP call', async () => {
    getWarehouses.mockResolvedValue({
      value: [{ WarehouseCode: 'WH1', WarehouseName: 'Main' }],
    });
    await searchSapWarehouses('');
    await searchSapWarehouses('main');
    expect(getWarehouses).toHaveBeenCalledTimes(1);
  });
});
