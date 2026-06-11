import { describe, expect, it } from 'vitest';
import { mapItemDetailsToLinePatch } from '@/lib/itemLineSelection';

describe('itemLineSelection', () => {
  it('mapItemDetailsToLinePatch maps warehouse, UoM, and price', () => {
    expect(
      mapItemDetailsToLinePatch({
        itemCode: 'ITM0000271',
        itemName: 'Widget',
        price: 100,
        ugpEntry: 1,
        uom: 'قطعة',
        uomCode: 'PCS',
        warehouseCode: '01',
        warehouseName: 'Smart Vision',
        warehouseLabel: '01 — Smart Vision',
        itemGroupName: 'كهربائيات',
      }),
    ).toMatchObject({
      itemCode: 'ITM0000271',
      itemName: 'Widget',
      estimatedUnitPrice: '100',
      unitPrice: '100',
      ugpEntry: 1,
      ugpName: 'قطعة',
      uomCode: 'PCS',
      warehouseCode: '01',
      warehouseLabel: '01 — Smart Vision',
      itemGroupName: 'كهربائيات',
    });
  });

  it('mapItemDetailsToLinePatch clears warehouse when missing', () => {
    expect(
      mapItemDetailsToLinePatch({
        itemCode: 'ITM1',
        itemName: 'X',
        warehouseCode: '',
        warehouseName: '',
      }),
    ).toMatchObject({
      warehouseCode: '',
      warehouseLabel: '',
    });
  });

  it('mapItemDetailsToLinePatch builds warehouse label when only code and name provided', () => {
    expect(
      mapItemDetailsToLinePatch({
        itemCode: 'ITM1',
        warehouseCode: 'KRA004',
        warehouseName: 'Main Warehouse',
      }).warehouseLabel,
    ).toBe('KRA004 — Main Warehouse');
  });
});
