import { describe, expect, it } from 'vitest';
import {
  mapVendorRow,
  mapWarehouseRow,
  mapProjectRow,
  mapCostCenterRow,
} from '@/lib/sapLookups';

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

  it('maps warehouse row', () => {
    expect(mapWarehouseRow({ WhsCode: '01', WhsName: 'Main' })).toEqual({
      warehouseCode: '01',
      warehouseName: 'Main',
    });
  });

  it('maps project row', () => {
    expect(mapProjectRow({ Code: 'P1', Name: 'Project 1' })).toEqual({
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
