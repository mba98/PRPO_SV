import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextNumber } from '@/lib/numbering';

const findOneAndUpdate = vi.fn();
const updateOne = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  connectDB: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/models/SystemSettings', () => ({
  default: {
    findOneAndUpdate: (...args) => findOneAndUpdate(...args),
    updateOne: (...args) => updateOne(...args),
  },
}));

describe('nextNumber', () => {
  beforeEach(() => {
    findOneAndUpdate.mockReset();
    updateOne.mockReset();
    updateOne.mockResolvedValue({ modifiedCount: 0 });
  });

  it('generates portal numbers using atomic top-level seq increment', async () => {
    findOneAndUpdate
      .mockResolvedValueOnce({ seq: 1 })
      .mockResolvedValueOnce({ seq: 2 });

    const first = await nextNumber('PR');
    const second = await nextNumber('PR');

    expect(first).toMatch(/^PR-\d{8}-0001$/);
    expect(second).toMatch(/^PR-\d{8}-0002$/);
    expect(findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(findOneAndUpdate.mock.calls[0][1]).toMatchObject({
      $inc: { seq: 1 },
      $setOnInsert: { type: 'counter' },
    });
    expect(findOneAndUpdate.mock.calls[0][1].$setOnInsert.key).toMatch(/^pr_seq_\d{8}$/);
    expect(findOneAndUpdate.mock.calls[0][1]).not.toHaveProperty('$inc.value.seq');
  });

  it('migrates legacy value.seq counters before incrementing', async () => {
    findOneAndUpdate.mockResolvedValueOnce({ seq: 3 });

    await nextNumber('PO');

    expect(updateOne).toHaveBeenCalledWith(
      { key: expect.stringMatching(/^po_seq_\d{8}$/), seq: { $exists: false }, 'value.seq': { $exists: true } },
      [{ $set: { seq: '$value.seq', type: 'counter' } }],
    );
  });

  it('falls back to legacy value.seq on returned document', async () => {
    findOneAndUpdate.mockResolvedValueOnce({ value: { seq: 7 } });

    const number = await nextNumber('APRI');

    expect(number).toMatch(/^APRI-\d{8}-0007$/);
  });
});
