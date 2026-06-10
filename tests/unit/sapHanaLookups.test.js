import { describe, expect, it } from 'vitest';
import { mapUomGroupRow } from '@/lib/sapHanaLookups';

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
});
