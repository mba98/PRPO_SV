import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextNumber } from '@/lib/numbering';

const findOneAndUpdate = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  connectDB: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/models/SystemSettings', () => ({
  default: {
    findOneAndUpdate: (...args) => findOneAndUpdate(...args),
  },
}));

describe('nextNumber', () => {
  beforeEach(() => {
    findOneAndUpdate.mockReset();
  });

  it('generates portal numbers using atomic sequence increment', async () => {
    findOneAndUpdate
      .mockResolvedValueOnce({ value: { seq: 1 } })
      .mockResolvedValueOnce({ value: { seq: 2 } });

    const first = await nextNumber('PR');
    const second = await nextNumber('PR');

    expect(first).toMatch(/^PR-\d{8}-0001$/);
    expect(second).toMatch(/^PR-\d{8}-0002$/);
    expect(findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(findOneAndUpdate.mock.calls[0][1]).toMatchObject({
      $inc: { 'value.seq': 1 },
    });
  });
});
