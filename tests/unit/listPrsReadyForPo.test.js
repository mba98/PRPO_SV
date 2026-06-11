import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('listPrsReadyForPo approved-for-po API', () => {
  const service = fs.readFileSync(
    path.resolve(process.cwd(), 'lib/purchaseOrdersService.js'),
    'utf8',
  );
  const route = fs.readFileSync(
    path.resolve(process.cwd(), 'app/api/purchase-requests/approved-for-po/route.js'),
    'utf8',
  );

  it('excludes PRs with active portal PO via relatedPRId distinct', () => {
    expect(service).toContain("PurchaseOrder.distinct('relatedPRId'");
    expect(service).toContain('poStatusInQuery(PO_STATUS.REJECTED)');
    expect(service).toContain('$nin: poStatusInQuery(PO_STATUS.REJECTED).$in');
    expect(service).toContain('buildReadyForPoPrFilter');
    expect(service).toContain('$nin: linkedPrIds');
    expect(service).toContain('prIsEligibleForReadyForPoList');
  });

  it('uses buildReadyForPoPrFilter for strict SAP PR criteria', () => {
    const readiness = fs.readFileSync(
      path.resolve(process.cwd(), 'lib/prPoReadiness.js'),
      'utf8',
    );
    expect(service).toContain('buildReadyForPoPrFilter()');
    expect(readiness).toContain("status: 'Created in SAP'");
    expect(readiness).toContain('sapPRDocEntry: { $exists: true, $ne: null }');
    expect(readiness).toContain('sapPRDocNum: { $exists: true, $ne: null');
    expect(service).not.toMatch(/Partially Ordered/);
  });

  it('route delegates to listPrsReadyForPo', () => {
    expect(route).toContain('listPrsReadyForPo');
  });
});
