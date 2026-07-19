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

vi.mock('@/lib/auth', () => ({
  withAuth: (handler) => handler,
}));

import { searchSapAccounts, searchSapCompanies } from '@/lib/sapHanaLookups.js';
import { parseItemCreationLookupQuery } from '@/lib/validators/sapLookup.js';
import { GET as getItemCompanies } from '@/app/api/sap/item-companies/route.js';

/** Routes company queries: UFD1 join → validValues rows, OITM distinct → usedValues rows. */
function mockCompanyQueries({ validValues = [], usedValues = [] }) {
  mocks.query.mockImplementation(async (sql) => {
    if (sql.includes('"UFD1"')) return validValues;
    if (sql.includes('"U_Company"')) return usedValues;
    return [];
  });
}

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
    mockCompanyQueries({ validValues: [{ code: 'SV', name: 'Smart Vision' }] });

    await expect(searchSapCompanies(query, 20)).resolves.toEqual([
      { value: 'SV', code: 'SV', label: 'Smart Vision', name: 'Smart Vision' },
    ]);

    const [validSql, validParams] = mocks.query.mock.calls[0];
    expect(validSql).toContain('"CUFD"');
    expect(validSql).toContain('"UFD1"');
    expect(validParams).toEqual([`%${query}%`, `%${query}%`, 20]);
    expect(validSql).not.toContain(query);

    const [usedSql, usedParams] = mocks.query.mock.calls[1];
    expect(usedSql).toContain('"OITM"');
    expect(usedSql).toContain('"U_Company"');
    expect(usedParams).toEqual([`%${query}%`, 20]);
    expect(usedSql).not.toContain(query);
  });

  it('falls back to OITM.U_Company values when UFD1 has no valid values', async () => {
    mockCompanyQueries({
      validValues: [],
      usedValues: [{ code: 'ACME' }, { code: 'GLOBEX' }],
    });

    await expect(searchSapCompanies('', 20)).resolves.toEqual([
      { value: 'ACME', code: 'ACME', label: 'ACME', name: 'ACME' },
      { value: 'GLOBEX', code: 'GLOBEX', label: 'GLOBEX', name: 'GLOBEX' },
    ]);
  });

  it('merges UFD1 valid values with OITM used values without duplicates', async () => {
    mockCompanyQueries({
      validValues: [{ code: 'SV', name: 'Smart Vision' }],
      usedValues: [{ code: 'SV' }, { code: 'ACME' }],
    });

    await expect(searchSapCompanies('', 20)).resolves.toEqual([
      { value: 'SV', code: 'SV', label: 'Smart Vision', name: 'Smart Vision' },
      { value: 'ACME', code: 'ACME', label: 'ACME', name: 'ACME' },
    ]);
  });

  it('uses code as name when UFD1 has no description', async () => {
    mockCompanyQueries({ validValues: [{ code: 'SV', name: '' }] });

    await expect(searchSapCompanies('', 20)).resolves.toEqual([
      { value: 'SV', code: 'SV', label: 'SV', name: 'SV' },
    ]);
  });

  it('uses wildcard parameters for an empty query and caps limit at 50', async () => {
    mocks.query.mockResolvedValue([]);
    await searchSapAccounts('', 500);
    expect(mocks.query.mock.calls[0][1]).toEqual(['%', '%', 50]);
  });

  it('filters empty and invalid lookup codes', async () => {
    mockCompanyQueries({
      validValues: [
        { code: '', name: 'Empty' },
        { code: '..', name: 'Invalid' },
        { code: 'OK', name: 'Valid' },
      ],
      usedValues: [{ code: '' }],
    });
    await expect(searchSapCompanies('', 20)).resolves.toEqual([
      { value: 'OK', code: 'OK', label: 'Valid', name: 'Valid' },
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

describe('GET /api/sap/item-companies endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connect.mockResolvedValue({
      query: mocks.query,
      close: mocks.close,
    });
  });

  it('returns merged companies for an empty search', async () => {
    mockCompanyQueries({
      validValues: [{ code: 'SV', name: 'Smart Vision' }],
      usedValues: [{ code: 'ACME' }],
    });

    const response = await getItemCompanies(
      new Request('http://localhost/api/sap/item-companies'),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual([
      { value: 'SV', code: 'SV', label: 'Smart Vision', name: 'Smart Vision' },
      { value: 'ACME', code: 'ACME', label: 'ACME', name: 'ACME' },
    ]);
    expect(mocks.query.mock.calls[0][1]).toEqual(['%', '%', 20]);
    expect(mocks.query.mock.calls[1][1]).toEqual(['%', 20]);
  });

  it('binds a partial company name search as a LIKE pattern', async () => {
    mockCompanyQueries({ validValues: [{ code: 'SV', name: 'Smart Vision' }] });

    const response = await getItemCompanies(
      new Request('http://localhost/api/sap/item-companies?query=smar&limit=10'),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([
      { value: 'SV', code: 'SV', label: 'Smart Vision', name: 'Smart Vision' },
    ]);
    expect(mocks.query.mock.calls[0][1]).toEqual(['%smar%', '%smar%', 10]);
    expect(mocks.query.mock.calls[1][1]).toEqual(['%smar%', 10]);
  });

  it('rejects an invalid limit with a validation error', async () => {
    const response = await getItemCompanies(
      new Request('http://localhost/api/sap/item-companies?limit=999'),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(mocks.query).not.toHaveBeenCalled();
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
