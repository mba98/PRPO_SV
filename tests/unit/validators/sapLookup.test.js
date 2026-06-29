import { describe, expect, it } from 'vitest';
import { parseSapLookupQuery } from '@/lib/validators/sapLookup';

describe('sapLookup validators', () => {
  it('parses query and limit', () => {
    const params = new URLSearchParams({ query: 'abc', limit: '10' });
    expect(parseSapLookupQuery(params)).toEqual({ query: 'abc', limit: 10, page: 1 });
  });

  it('defaults empty query', () => {
    const params = new URLSearchParams();
    expect(parseSapLookupQuery(params)).toEqual({ query: '', limit: 20, page: 1 });
  });
});
