import { describe, expect, it, vi, beforeEach } from 'vitest';
import { searchSapItems, mapHanaItemRow } from '@/lib/sapItems';

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
});
