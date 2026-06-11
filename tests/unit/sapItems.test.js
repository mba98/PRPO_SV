import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  searchSapItems,
  mapHanaItemRow,
  mapItemDetailRow,
  buildSapItemCreatePayload,
  getSapItemSeries,
} from '@/lib/sapItems';

vi.mock('@/lib/sapHana.js', () => ({
  searchItems: vi.fn(),
  getItemDetail: vi.fn(),
}));

vi.mock('@/lib/sapServiceLayer.js', () => ({
  getItem: vi.fn(),
  createItem: vi.fn(),
}));

import { searchItems } from '@/lib/sapHana.js';

describe('sapItems search helper', () => {
  beforeEach(() => {
    searchItems.mockReset();
    process.env.SAP_ITEM_SERIES = '129';
  });

  afterEach(() => {
    delete process.env.SAP_ITEM_SERIES;
  });

  it('returns empty array for blank query', async () => {
    expect(await searchSapItems('')).toEqual([]);
    expect(searchItems).not.toHaveBeenCalled();
  });

  it('maps HANA rows to normalized API shape', async () => {
    searchItems.mockResolvedValue([
      {
        ItemCode: 'A1',
        ItemName: 'Widget',
        PurPackMsr: 'EA',
        BuyUnitMsr: 'BX',
        InvntryUom: 'EA',
        ItmsGrpCod: 10,
        ItmsGrpNam: 'Parts',
      },
    ]);
    const rows = await searchSapItems('wid');
    expect(rows[0]).toMatchObject({
      itemCode: 'A1',
      itemName: 'Widget',
      uom: 'EA',
      purchaseUom: 'EA',
      inventoryUom: 'EA',
      itemGroupCode: 10,
      itemGroupName: 'Parts',
      itemGroup: 'Parts',
    });
  });

  it('mapHanaItemRow handles uppercase ODBC keys', () => {
    const row = mapHanaItemRow({
      ITEMCODE: 'X',
      ITEMNAME: 'Y',
      PURPACKMSR: 'PC',
      ITMSGRPNAM: 'G',
    });
    expect(row.itemCode).toBe('X');
    expect(row.uom).toBe('PC');
  });

  it('getSapItemSeries reads SAP_ITEM_SERIES from env', () => {
    process.env.SAP_ITEM_SERIES = '129';
    expect(getSapItemSeries()).toBe(129);
  });

  it('getSapItemSeries throws when not configured', () => {
    delete process.env.SAP_ITEM_SERIES;
    expect(() => getSapItemSeries()).toThrow('SAP_ITEM_SERIES is not configured');
  });

  it('buildSapItemCreatePayload sends Series and omits ItemCode', () => {
    expect(
      buildSapItemCreatePayload({
        ItemName: 'Widget',
        ItemGroup: '108',
        UgpEntry: 1,
        U_Code: 'PN-1',
        U_AcctCode: '4000',
        U_Company: 'ACME',
        DefaultWarehouse: '',
      }),
    ).toEqual({
      Series: 129,
      ItemName: 'Widget',
      ItemsGroupCode: 108,
      UoMGroupEntry: 1,
      U_Code: 'PN-1',
      U_AcctCode: '4000',
      U_Company: 'ACME',
    });
    expect(
      buildSapItemCreatePayload({
        ItemName: 'X',
        DefaultWarehouse: 'WH01',
      }).DefaultWarehouse,
    ).toBe('WH01');
  });

  it('buildSapItemCreatePayload does not include ItemCode', () => {
    const payload = buildSapItemCreatePayload({ ItemName: 'Widget' });
    expect(payload).not.toHaveProperty('ItemCode');
    expect(payload.Series).toBe(129);
  });

  it('mapItemDetailRow maps price, UoM group, and warehouse', () => {
    expect(
      mapItemDetailRow({
        ItemCode: 'A1',
        ItemName: 'Widget',
        UgpEntry: 1,
        UgpName: 'Manual',
        DfltWH: 'KRA004',
        WhsName: 'Main Warehouse',
        AvgPrice: 100,
      }),
    ).toEqual({
      itemCode: 'A1',
      itemName: 'Widget',
      price: 100,
      uomGroupEntry: 1,
      uomGroupName: 'Manual',
      warehouseCode: 'KRA004',
      warehouseName: 'Main Warehouse',
      itemGroupCode: undefined,
      itemGroupName: undefined,
    });
  });

  it('mapItemDetailRow trims warehouse code from OITM.DfltWH', () => {
    expect(
      mapItemDetailRow({
        ItemCode: 'A1',
        DfltWH: '  KRA004  ',
        WhsName: ' Main ',
      }),
    ).toMatchObject({
      warehouseCode: 'KRA004',
      warehouseName: 'Main',
    });
  });
});
