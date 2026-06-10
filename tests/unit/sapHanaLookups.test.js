import { describe, expect, it } from 'vitest';
import { mapUomGroupRow, mapItemGroupRow, mapWarehouseRow } from '@/lib/sapHanaLookups';

describe('mapUomGroupRow', () => {
  it('maps HANA aliased columns to value/label/code', () => {
    expect(mapUomGroupRow({ value: 1, label: 'Manual', code: 'Manual' })).toEqual({
      value: 1,
      label: 'Manual',
      code: 'Manual',
    });
  });

  it('falls back to UgpEntry/UgpName/UgpCode column names', () => {
    expect(mapUomGroupRow({ UgpEntry: 2, UgpName: 'Weight', UgpCode: 'Weight' })).toEqual({
      value: 2,
      label: 'Weight',
      code: 'Weight',
    });
  });

  it('maps item group and warehouse rows to value/label/code', () => {
    expect(mapItemGroupRow({ value: 10, label: 'Parts', code: 10 })).toEqual({
      value: 10,
      label: 'Parts',
      code: '10',
    });
    expect(mapWarehouseRow({ value: 'KRA004', label: 'Main', code: 'KRA004' })).toEqual({
      value: 'KRA004',
      label: 'Main',
      code: 'KRA004',
    });
  });
});
