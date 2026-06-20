import { describe, expect, it } from 'vitest';
import {
  formatMoney,
  formatMoneyInput,
  formatMoneyWithCurrency,
  normalizeLpCurrency,
  parseMoneyInput,
} from '@/lib/lpMoney.js';
import { extractLocalPurchaseDocument, wrapLocalPurchaseResponse } from '@/lib/localPurchaseDocument.js';

describe('lpMoney', () => {
  it('parses comma-separated input as plain number', () => {
    expect(parseMoneyInput('1,000,000')).toBe(1000000);
    expect(parseMoneyInput('1,000.50')).toBe(1000.5);
  });

  it('formats IQD with thousand separators and no decimals', () => {
    expect(formatMoney(1000000, 'IQD')).toBe('1,000,000');
    expect(formatMoneyWithCurrency(1000, 'IQD')).toBe('IQD 1,000');
  });

  it('formats USD with two decimal places', () => {
    expect(formatMoney(1000, 'USD')).toBe('1,000.00');
    expect(formatMoneyWithCurrency(850.5, 'USD')).toBe('USD 850.50');
  });

  it('formatMoneyInput supports editable display values', () => {
    expect(formatMoneyInput(1000000, 'IQD')).toBe('1,000,000');
    expect(formatMoneyInput('1000000', 'USD')).toBe('1,000,000');
  });

  it('defaults unknown currency to IQD for display helpers', () => {
    expect(normalizeLpCurrency(undefined)).toBe('IQD');
    expect(normalizeLpCurrency('usd')).toBe('USD');
  });
});

describe('localPurchaseDocument helpers', () => {
  it('wraps and extracts document payloads consistently', () => {
    const doc = { id: 'lp1', __v: 2, currency: 'IQD', budget: 1000 };
    const wrapped = wrapLocalPurchaseResponse(doc);
    expect(wrapped.document.__v).toBe(2);
    expect(extractLocalPurchaseDocument(wrapped)).toEqual(doc);
    expect(extractLocalPurchaseDocument({ localPurchase: doc })).toEqual(doc);
    expect(extractLocalPurchaseDocument(doc)).toEqual(doc);
  });
});
