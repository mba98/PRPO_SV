import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  buildPrSapDebugMeta,
  formatSapReferenceSummary,
  isMongoObjectIdString,
  mapPrToSap,
  normalizeSapRequesterValue,
  resolveBranchId,
  resolveRequesterSapCode,
  validatePrSapPayload,
} from '@/lib/sap/mappers/prToSap';

const OBJECT_ID = '507f1f77bcf86cd799439011';

describe('prToSap mapper', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('resolves branch from map then env default', () => {
    expect(resolveBranchId('Sales', { Sales: 3 })).toBe(3);
    vi.stubEnv('SAP_DEFAULT_BRANCH_ID', '7');
    expect(resolveBranchId('Unknown', {})).toBe(7);
  });

  it('detects MongoDB ObjectId strings', () => {
    expect(isMongoObjectIdString(OBJECT_ID)).toBe(true);
    expect(isMongoObjectIdString('EMP001')).toBe(false);
  });

  it('does not send MongoDB ObjectId as Requester', () => {
    const pr = {
      requester: OBJECT_ID,
      requesterEmail: 'user@example.com',
      department: 'IT',
      requiredDate: new Date('2026-05-21'),
      lines: [{ itemCode: 'ITEM1', quantity: 1, warehouseCode: 'WH01' }],
    };
    const payload = mapPrToSap(pr, { branchMap: { IT: 2 } });
    expect(payload.Requester).toBeUndefined();
    expect(String(payload.Requester || '')).not.toBe(OBJECT_ID);
  });

  it('normalizes numeric requester codes to integers', () => {
    expect(normalizeSapRequesterValue('12')).toBe(12);
    expect(normalizeSapRequesterValue('EMP-42')).toBe('EMP-42');
  });

  it('omits costing code when omitCostingCode option is set', () => {
    const pr = {
      department: 'IT',
      requiredDate: new Date('2026-05-21'),
      lines: [{ itemCode: 'ITEM1', quantity: 1, warehouseCode: 'WH01', costCenter: 'CC1' }],
    };
    const payload = mapPrToSap(pr, {
      branchMap: { IT: 2 },
      requesterSapCode: '12',
      omitCostingCode: true,
    });
    expect(payload.DocumentLines[0].CostingCode).toBeUndefined();
    expect(payload.Requester).toBe(12);
  });

  it('uses user sapRequesterCode when provided', () => {
    const pr = {
      requester: OBJECT_ID,
      department: 'IT',
      requiredDate: new Date('2026-05-21'),
      lines: [{ itemCode: 'ITEM1', quantity: 1, warehouseCode: 'WH01' }],
    };
    const payload = mapPrToSap(pr, {
      branchMap: { IT: 2 },
      requesterSapCode: 'EMP-42',
    });
    expect(payload.Requester).toBe('EMP-42');
  });

  it('uses configured default requester when user code is missing', () => {
    const pr = {
      requester: OBJECT_ID,
      department: 'IT',
      requiredDate: new Date('2026-05-21'),
      lines: [{ itemCode: 'ITEM1', quantity: 1, warehouseCode: 'WH01' }],
    };
    expect(
      resolveRequesterSapCode(pr, { defaultRequesterCode: 'DEFAULT_EMP' }),
    ).toBe('DEFAULT_EMP');
    const payload = mapPrToSap(pr, {
      branchMap: { IT: 2 },
      defaultRequesterCode: 'DEFAULT_EMP',
    });
    expect(payload.Requester).toBe('DEFAULT_EMP');
  });

  it('returns validation error when SAP requester code is missing', () => {
    const pr = {
      requester: OBJECT_ID,
      department: 'IT',
      requiredDate: new Date('2026-05-21'),
      lines: [{ itemCode: 'ITEM1', quantity: 1, warehouseCode: 'WH01' }],
    };
    const payload = mapPrToSap(pr, { branchMap: { IT: 2 } });
    const validation = validatePrSapPayload(pr, payload, { requesterUsername: 'requester' });
    expect(validation.ok).toBe(false);
    expect(validation.errors.join('; ')).toMatch(
      /Missing SAP requester code for PR requester requester/,
    );
  });

  it('maps PR document to SAP payload shape', () => {
    const pr = {
      requesterEmail: 'user@example.com',
      department: 'IT',
      requiredDate: new Date('2026-05-21'),
      documentDate: new Date('2026-05-20'),
      remarks: 'Need laptops',
      warehouse: 'WH01',
      project: 'PRJ1',
      lines: [
        {
          itemCode: 'ITEM1',
          quantity: 2,
          warehouseCode: 'WH01',
          projectCode: 'PRJ1',
          costCenter: 'CC1',
          estimatedUnitPrice: 100,
          requiredDate: new Date('2026-05-25'),
        },
      ],
    };
    const payload = mapPrToSap(pr, {
      branchMap: { IT: 2 },
      requesterSapCode: 'EMP001',
    });
    expect(payload.Requester).toBe('EMP001');
    expect(payload.BPL_IDAssignedToInvoice).toBe(2);
    expect(payload.U_Department).toBe('IT');
    expect(payload.DocumentLines).toHaveLength(1);
    expect(payload.DocumentLines[0].ItemCode).toBe('ITEM1');
    expect(payload.ReqDate).toBe('2026-05-21');
  });

  it('builds safe debug metadata without secrets', () => {
    const pr = {
      portalPRNumber: 'PR-20260521-0001',
      _id: OBJECT_ID,
      department: 'IT',
      requiredDate: new Date('2026-05-21'),
      lines: [{ itemCode: 'ITEM1', quantity: 1, warehouseCode: 'WH01' }],
    };
    const payload = mapPrToSap(pr, { requesterSapCode: 'EMP001', branchMap: { IT: 1 } });
    const meta = buildPrSapDebugMeta(pr, payload, {
      requesterUserId: OBJECT_ID,
      requesterUsername: 'requester',
    });
    expect(meta.portalPRNumber).toBe('PR-20260521-0001');
    expect(meta.sapRequesterCode).toBe('EMP001');
    expect(meta.lines[0].ItemCode).toBe('ITEM1');
    expect(JSON.stringify(meta)).not.toMatch(/password|cookie|B1SESSION/i);
  });

  it('formats SAP reference summary for error messages', () => {
    const payload = {
      Requester: 12,
      BPL_IDAssignedToInvoice: 1,
      DocumentLines: [{ ItemCode: 'A1', WarehouseCode: 'WH1', CostingCode: 'Project' }],
    };
    const summary = formatSapReferenceSummary(payload, {
      sapRequesterCode: 12,
      header: { BPL_IDAssignedToInvoice: 1, ReqType: 12 },
      lines: [{ ItemCode: 'A1', WarehouseCode: 'WH1', CostingCode: 'Project' }],
    });
    expect(summary).toMatch(/Requester=12/);
    expect(summary).toMatch(/CostCenter=Project/);
  });
});
