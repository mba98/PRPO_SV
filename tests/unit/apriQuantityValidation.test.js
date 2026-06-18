import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  poLines: [{ _id: 'po-line-1', itemCode: 'ITM0000271', quantity: 1 }],
  otherApris: [],
}));

vi.mock('@/models/PurchaseOrder.js', () => ({
  default: {
    findById: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: 'po-1', lines: mocks.poLines }),
    }),
  },
}));

vi.mock('@/models/APReserveInvoice.js', () => ({
  default: {
    find: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockImplementation(async () => mocks.otherApris),
      }),
    }),
  },
}));

import { validateApriQuantityUpdates } from '@/lib/apriQuantityValidation.js';

function makeApri(
  lines = [
    {
      _id: 'line-1',
      relatedPOLineId: 'po-line-1',
      itemCode: 'ITM0000271',
      quantity: 1,
    },
  ],
) {
  return {
    _id: 'apri-1',
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
    mocks.otherApris = [];
  });

  it('accepts valid quantity within remaining PO limit', async () => {
    await expect(
      validateApriQuantityUpdates(makeApri(), [{ _id: 'line-1', quantity: 1 }]),
    ).resolves.toBeUndefined();
  });

  it('returns structured line errors when quantity exceeds remaining PO quantity', async () => {
    await expect(
      validateApriQuantityUpdates(makeApri(), [{ _id: 'line-1', quantity: 3 }]),
    ).rejects.toMatchObject({
      code: 'APRI_QUANTITY_EXCEEDS_PO',
      message: expect.stringContaining('ITM0000271'),
      errors: [
        expect.objectContaining({
          lineId: 'line-1',
          itemCode: 'ITM0000271',
          field: 'quantity',
          requestedQuantity: 3,
          maximumQuantity: 1,
        }),
      ],
    });
  });

  it('rejects unknown line ids', async () => {
    await expect(
      validateApriQuantityUpdates(makeApri(), [{ _id: 'other', quantity: 1 }]),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('subtracts quantities consumed by other APRIs on the same PO line', async () => {
    mocks.otherApris = [
      {
        lines: [{ relatedPOLineId: 'po-line-1', quantity: 0.5 }],
      },
    ];
    await expect(
      validateApriQuantityUpdates(makeApri(), [{ _id: 'line-1', quantity: 0.6 }]),
    ).rejects.toMatchObject({ code: 'APRI_QUANTITY_EXCEEDS_PO' });
    await expect(
      validateApriQuantityUpdates(makeApri(), [{ _id: 'line-1', quantity: 0.5 }]),
    ).resolves.toBeUndefined();
  });
});
