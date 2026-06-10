import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  searchSapItems,
  mapHanaItemRow,
  mapItemDetailRow,
  buildSapItemCreatePayload,
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

  it('buildSapItemCreatePayload maps Service Layer fields and omits empty warehouse', () => {
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
});
