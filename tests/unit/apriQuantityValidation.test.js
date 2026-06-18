import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  poLines: [{ _id: 'po-line-1', itemCode: 'ITEM1', quantity: 10 }],
}));

vi.mock('@/models/PurchaseOrder.js', () => ({
  default: {
    findById: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: 'po-1', lines: mocks.poLines }),
    }),
  },
}));

import { validateApriQuantityUpdates } from '@/lib/apriQuantityValidation.js';

function makeApri(lines = [{ _id: 'line-1', relatedPOLineId: 'po-line-1', itemCode: 'ITEM1', quantity: 5 }]) {
  return {
    relatedPOId: 'po-1',
    lines: {
      id(id) {
        return lines.find((l) => l._id === id);
      },
      get length() {
        return lines.length;
      },
      [Symbol.iterator]() {
        return lines[Symbol.iterator]();
      },
    },
  };
}

describe('validateApriQuantityUpdates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts valid quantity within PO limit', async () => {
    await expect(
      validateApriQuantityUpdates(makeApri(), [{ _id: 'line-1', quantity: 8 }]),
    ).resolves.toBeUndefined();
  });

  it('rejects quantity above PO line quantity', async () => {
    await expect(
      validateApriQuantityUpdates(makeApri(), [{ _id: 'line-1', quantity: 11 }]),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('rejects unknown line ids', async () => {
    await expect(
      validateApriQuantityUpdates(makeApri(), [{ _id: 'other', quantity: 1 }]),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});
