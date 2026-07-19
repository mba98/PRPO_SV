import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  process.env.HANA_CONNECTION_STRING = 'Driver=mock';
  process.env.HANA_SCHEMA = 'TEST_COMPANY';
  return {
    query: vi.fn(),
    close: vi.fn(),
    connect: vi.fn(),
    serviceLayerAccounts: vi.fn(),
    serviceLayerCompanies: vi.fn(),
  };
});

vi.mock('odbc', () => ({
  default: {
    connect: mocks.connect,
  },
}));

vi.mock('@/lib/sapServiceLayer.js', () => ({
  getAccounts: mocks.serviceLayerAccounts,
  getCompanies: mocks.serviceLayerCompanies,
}));

import { searchSapAccounts, searchSapCompanies } from '@/lib/sapHanaLookups.js';
import { parseItemCreationLookupQuery } from '@/lib/validators/sapLookup.js';

describe('item creation HANA lookups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connect.mockResolvedValue({
      query: mocks.query,
      close: mocks.close,
    });
  });

  it.each(['100100', 'cash'])('binds account search "%s" by code/name', async (query) => {
    mocks.query.mockResolvedValue([{ code: '100100', name: 'Cash account' }]);

    await expect(searchSapAccounts(query, 20)).resolves.toEqual([
      { value: '100100', code: '100100', label: 'Cash account' },
    ]);

    const [sql, params] = mocks.query.mock.calls[0];
    expect(sql).toContain('"OACT"');
    expect(sql).toContain('T0."Postable" = \'Y\'');
    expect(params).toEqual([`%${query}%`, `%${query}%`, 20]);
    expect(sql).not.toContain(query);
  });

  it.each(['SV', 'Smart Vision'])('binds Company search "%s" by FldValue/Descr', async (query) => {
    mocks.query.mockResolvedValue([{ code: 'SV', name: 'Smart Vision' }]);

    await expect(searchSapCompanies(query, 20)).resolves.toEqual([
      { value: 'SV', code: 'SV', label: 'Smart Vision' },
    ]);

    const [sql, params] = mocks.query.mock.calls[0];
    expect(sql).toContain('"CUFD"');
    expect(sql).toContain('"UFD1"');
    expect(params).toEqual([`%${query}%`, `%${query}%`, 20]);
    expect(sql).not.toContain(query);
  });

  it('uses wildcard parameters for an empty query and caps limit at 50', async () => {
    mocks.query.mockResolvedValue([]);
    await searchSapAccounts('', 500);
    expect(mocks.query.mock.calls[0][1]).toEqual(['%', '%', 50]);
  });

  it('filters empty and invalid lookup codes', async () => {
    mocks.query.mockResolvedValue([
      { code: '', name: 'Empty' },
      { code: '..', name: 'Invalid' },
      { code: 'OK', name: 'Valid' },
    ]);
    await expect(searchSapCompanies('', 20)).resolves.toEqual([
      { value: 'OK', code: 'OK', label: 'Valid' },
    ]);
  });

  it('does not call Service Layer for accounts or item companies', async () => {
    mocks.query.mockResolvedValue([]);
    await searchSapAccounts('', 20);
    await searchSapCompanies('', 20);
    expect(mocks.serviceLayerAccounts).not.toHaveBeenCalled();
    expect(mocks.serviceLayerCompanies).not.toHaveBeenCalled();
  });
});

describe('item creation lookup query validation', () => {
  it('accepts an empty query and defaults limit to 20', () => {
    const params = new URLSearchParams();
    expect(parseItemCreationLookupQuery(params)).toEqual({ query: '', limit: 20 });
  });

  it.each(['0', '51', 'abc', '2.5'])('rejects invalid limit "%s"', (limit) => {
    const params = new URLSearchParams({ limit });
    expect(() => parseItemCreationLookupQuery(params)).toThrow();
  });
});

describe('item creation lookup routes and modal wiring', () => {
  const accountsRoute = fs.readFileSync(
    path.resolve(process.cwd(), 'app/api/sap/accounts/route.js'),
    'utf8',
  );
  const companiesRoute = fs.readFileSync(
    path.resolve(process.cwd(), 'app/api/sap/item-companies/route.js'),
    'utf8',
  );
  const modal = fs.readFileSync(
    path.resolve(process.cwd(), 'components/purchase-requests/CreateItemModal.jsx'),
    'utf8',
  );
  const service = fs.readFileSync(path.resolve(process.cwd(), 'lib/sapHanaLookups.js'), 'utf8');

  it('protects both Node.js routes with items.create only', () => {
    for (const route of [accountsRoute, companiesRoute]) {
      expect(route).toContain("export const runtime = 'nodejs'");
      expect(route).toContain("withAuth(getHandler, ['items.create'])");
    }
  });

  it('uses the HANA endpoints in CreateItemModal', () => {
    expect(modal).toContain('endpoint="/api/sap/accounts"');
    expect(modal).toContain('endpoint="/api/sap/item-companies"');
    expect(modal).not.toContain('endpoint="/api/sap/companies"');
  });

  it('contains no Service Layer dependency in account/company lookup service', () => {
    expect(service).not.toContain('sapServiceLayer');
  });
});
