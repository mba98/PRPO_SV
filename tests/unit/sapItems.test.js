import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  searchSapItems,
  mapHanaItemRow,
  mapItemDetailRow,
  formatItemWarehouseFields,
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

  it('formatItemWarehouseFields builds label from code and name', () => {
    expect(formatItemWarehouseFields('KRA004', 'Main Warehouse')).toEqual({
      warehouseCode: 'KRA004',
      warehouseName: 'Main Warehouse',
      warehouseLabel: 'KRA004 — Main Warehouse',
    });
    expect(formatItemWarehouseFields('-', 'Ignored')).toEqual({
      warehouseCode: '',
      warehouseName: 'Ignored',
      warehouseLabel: '',
    });
    expect(formatItemWarehouseFields('', '')).toEqual({
      warehouseCode: '',
      warehouseName: '',
      warehouseLabel: '',
    });
  });

  it('mapItemDetailRow maps price, UoM group, and warehouse from SQL aliases', () => {
    expect(
      mapItemDetailRow({
        itemCode: 'A1',
        itemName: 'Widget',
        ugpEntry: 1,
        uom: 'Manual',
        warehouseCode: 'KRA004',
        warehouseName: 'Main Warehouse',
        price: 100,
      }),
    ).toEqual({
      itemCode: 'A1',
      itemName: 'Widget',
      price: 100,
      ugpEntry: 1,
      uom: 'Manual',
      uomCode: undefined,
      uomGroupEntry: 1,
      uomGroupName: 'Manual',
      warehouseCode: 'KRA004',
      warehouseName: 'Main Warehouse',
      warehouseLabel: 'KRA004 — Main Warehouse',
      itemGroupCode: undefined,
      itemGroupName: undefined,
    });
  });

  it('mapItemDetailRow returns empty warehouse fields when DfltWH is missing', () => {
    expect(
      mapItemDetailRow({
        itemCode: 'A1',
        warehouseCode: '',
        warehouseName: '',
      }),
    ).toMatchObject({
      warehouseCode: '',
      warehouseName: '',
      warehouseLabel: '',
    });
  });

  it('mapItemDetailRow uses OITW fallback warehouse from SQL alias', () => {
    expect(
      mapItemDetailRow({
        itemCode: 'ITM0000271',
        warehouseCode: '01',
        warehouseName: 'Smart Vision',
        uomCode: 'PCS',
        uom: 'قطعة',
        ugpEntry: 1,
      }),
    ).toMatchObject({
      warehouseCode: '01',
      warehouseName: 'Smart Vision',
      warehouseLabel: '01 — Smart Vision',
      uomCode: 'PCS',
      uom: 'قطعة',
    });
  });

  it('mapHanaItemRow includes warehouse from search SQL aliases', () => {
    expect(
      mapHanaItemRow({
        itemCode: 'ITM1',
        itemName: 'Widget',
        warehouseCode: 'KRA004',
        warehouseName: 'Main',
        ugpEntry: 1,
      }),
    ).toMatchObject({
      warehouseCode: 'KRA004',
      warehouseName: 'Main',
      warehouseLabel: 'KRA004 — Main',
    });
  });
});
