import { describe, expect, it, vi, beforeEach } from 'vitest';
import { searchSapItems } from '@/lib/sapItems';

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

  it('maps HANA rows to API shape', async () => {
    searchItems.mockResolvedValue([
      { ItemCode: 'A1', ItemName: 'Widget', PurPackMsr: 'EA', ItmsGrpNam: 'Parts' },
    ]);
    const rows = await searchSapItems('wid');
    expect(rows).toEqual([
      { itemCode: 'A1', itemName: 'Widget', uom: 'EA', itemGroup: 'Parts' },
    ]);
  });
});
