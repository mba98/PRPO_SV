import { describe, expect, it } from 'vitest';
import {
  buildLineQtyMap,
  lineQtyMapsEqual,
  normalizeQuantity,
} from '@/lib/apriDetailQuantityState.js';

describe('ApriDetailView quantity state', () => {
  it('normalizes string and numeric quantities as equal', () => {
    expect(normalizeQuantity('6')).toBe(6);
    expect(normalizeQuantity(6)).toBe(6);
  });

  it('detects no unsaved changes when string and number match', () => {
    expect(
      lineQtyMapsEqual({ line1: '6', line2: '199' }, { line1: 6, line2: 199 }),
    ).toBe(true);
  });

  it('detects unsaved changes after quantity edit', () => {
    expect(lineQtyMapsEqual({ line1: 6 }, { line1: 5 })).toBe(false);
  });

  it('builds numeric baseline from saved lines', () => {
    expect(
      buildLineQtyMap([
        { _id: 'a', quantity: 6 },
        { _id: 'b', quantity: 199 },
      ]),
    ).toEqual({ a: 6, b: 199 });
  });
});
