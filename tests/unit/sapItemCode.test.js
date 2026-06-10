import { describe, expect, it } from 'vitest';
import {
  buildItemCodePattern,
  computeNextItemCode,
  getItemCodePrefix,
  getItemCodeStart,
} from '@/lib/sapItemCode.js';

describe('sapItemCode', () => {
  it('buildItemCodePattern matches prefix + digits only', () => {
    const pattern = buildItemCodePattern('125');
    expect(pattern.test('1250000133')).toBe(true);
    expect(pattern.test('1250000134')).toBe(true);
    expect(pattern.test('125ABC')).toBe(false);
    expect(pattern.test('ALK00004SV')).toBe(false);
  });

  it('computeNextItemCode increments numeric series', () => {
    expect(
      computeNextItemCode('1250000133', { prefix: '125', startCode: '1250000001' }),
    ).toBe('1250000134');
  });

  it('computeNextItemCode uses start when no last code', () => {
    expect(
      computeNextItemCode(undefined, { prefix: '125', startCode: '1250000001' }),
    ).toBe('1250000001');
  });

  it('computeNextItemCode uses start when last code does not match pattern', () => {
    expect(
      computeNextItemCode('125FOO', { prefix: '125', startCode: '1250000001' }),
    ).toBe('1250000001');
  });

  it('getItemCodePrefix defaults to 125', () => {
    const prev = process.env.SAP_ITEM_CODE_PREFIX;
    delete process.env.SAP_ITEM_CODE_PREFIX;
    expect(getItemCodePrefix()).toBe('125');
    if (prev !== undefined) process.env.SAP_ITEM_CODE_PREFIX = prev;
  });

  it('getItemCodeStart derives from prefix when unset', () => {
    const prevStart = process.env.SAP_ITEM_CODE_START;
    delete process.env.SAP_ITEM_CODE_START;
    expect(getItemCodeStart('125')).toBe('1250000001');
    if (prevStart !== undefined) process.env.SAP_ITEM_CODE_START = prevStart;
  });
});
