import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  buildPrSapDebugMeta,
  formatSapReferenceSummary,
  isInvalidSapOptionalCode,
  isMongoObjectIdString,
  mapPrToSap,
  normalizeSapRequesterValue,
  resolveBranchId,
  resolveRequesterSapCode,
  SAP_PR_DOC_TYPE,
  validatePrSapPayload,
} from '@/lib/sap/mappers/prToSap';
import { DEV_DEFAULT_BRANCH_ID } from '@/lib/sap/sapBranchConfig.js';

const OBJECT_ID = '507f1f77bcf86cd799439011';
const PROCUREMENT_BRANCH_MAP = { Procurement: -2, default: -2 };
const PROCUREMENT_DEPARTMENT_MAP = { Procurement: 'General', default: 'General' };

const basePr = {
  department: 'Procurement',
  requiredDate: new Date('2026-05-21'),
  documentDate: new Date('2026-05-20'),
  lines: [{ itemCode: 'ALR00027SV', quantity: 100, warehouseCode: 'RAN001' }],
};

describe('prToSap mapper', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps ReqType=12', () => {
    const payload = mapPrToSap(basePr, {
      branchMap: PROCUREMENT_BRANCH_MAP,
      departmentMap: PROCUREMENT_DEPARTMENT_MAP,
      requesterSapCode: '12',
    });
    expect(payload.ReqType).toBe(12);
  });

  it('sends Requester="12"', () => {
    const payload = mapPrToSap(basePr, {
      branchMap: PROCUREMENT_BRANCH_MAP,
      departmentMap: PROCUREMENT_DEPARTMENT_MAP,
      requesterSapCode: '12',
    });
    expect(payload.Requester).toBe('12');
    expect(normalizeSapRequesterValue('12')).toBe('12');
  });

  it('sends BPL_IDAssignedToInvoice=-2 for Procurement', () => {
    const payload = mapPrToSap(basePr, {
      branchMap: PROCUREMENT_BRANCH_MAP,
      departmentMap: PROCUREMENT_DEPARTMENT_MAP,
      requesterSapCode: '12',
    });
    expect(payload.BPL_IDAssignedToInvoice).toBe(-2);
    expect(resolveBranchId('Procurement', PROCUREMENT_BRANCH_MAP)).toBe(-2);
  });

  it('sends DocType=dDocument_Items', () => {
    const payload = mapPrToSap(basePr, {
      branchMap: PROCUREMENT_BRANCH_MAP,
      departmentMap: PROCUREMENT_DEPARTMENT_MAP,
      requesterSapCode: '12',
    });
    expect(payload.DocType).toBe('dDocument_Items');
    expect(SAP_PR_DOC_TYPE).toBe('dDocument_Items');
  });

  it('maps U_Department to General for Procurement', () => {
    const payload = mapPrToSap(basePr, {
      branchMap: PROCUREMENT_BRANCH_MAP,
      departmentMap: PROCUREMENT_DEPARTMENT_MAP,
      requesterSapCode: '12',
    });
    expect(payload.U_Department).toBe('General');
  });

  it('does not send CostingCode for placeholder cost center Project', () => {
    const pr = {
      ...basePr,
      lines: [
        {
          itemCode: 'ALR00027SV',
          quantity: 100,
          warehouseCode: 'RAN001',
          costCenter: 'Project',
        },
      ],
    };
    const payload = mapPrToSap(pr, {
      branchMap: PROCUREMENT_BRANCH_MAP,
      departmentMap: PROCUREMENT_DEPARTMENT_MAP,
      requesterSapCode: '12',
    });
    expect(isInvalidSapOptionalCode('Project')).toBe(true);
    expect(payload.DocumentLines[0].CostingCode).toBeUndefined();
  });

  it('does not send CostingCode when cost center is empty or dash', () => {
    const pr = {
      ...basePr,
      lines: [
        { itemCode: 'A1', quantity: 1, warehouseCode: 'WH1', costCenter: '-' },
        { itemCode: 'A2', quantity: 1, warehouseCode: 'WH1', costCenter: '' },
      ],
    };
    const payload = mapPrToSap(pr, {
      branchMap: PROCUREMENT_BRANCH_MAP,
      departmentMap: PROCUREMENT_DEPARTMENT_MAP,
      requesterSapCode: '12',
    });
    expect(payload.DocumentLines[0].CostingCode).toBeUndefined();
    expect(payload.DocumentLines[1].CostingCode).toBeUndefined();
  });

  it('returns validation error when branch mapping is missing in production', () => {
    const prevNodeEnv = process.env.NODE_ENV;
    delete process.env.SAP_DEFAULT_BRANCH_ID;
    process.env.NODE_ENV = 'production';

    const pr = { ...basePr, department: 'Procurement' };
    const payload = mapPrToSap(pr, {
      branchMap: {},
      departmentMap: {},
      requesterSapCode: '12',
    });
    expect(payload.BPL_IDAssignedToInvoice).toBeNull();

    const validation = validatePrSapPayload(pr, payload, { requesterUsername: 'requester' });
    expect(validation.ok).toBe(false);
    expect(validation.errors.join('; ')).toMatch(
      /Missing SAP branch mapping for department Procurement/,
    );

    process.env.NODE_ENV = prevNodeEnv;
  });

  it('uses dev branch default -2 when map missing outside production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(resolveBranchId('Unknown', {})).toBe(DEV_DEFAULT_BRANCH_ID);
  });

  it('does not send MongoDB ObjectId as Requester', () => {
    const pr = {
      requester: OBJECT_ID,
      requesterEmail: 'user@example.com',
      department: 'Procurement',
      requiredDate: new Date('2026-05-21'),
      lines: [{ itemCode: 'ITEM1', quantity: 1, warehouseCode: 'WH01' }],
    };
    const payload = mapPrToSap(pr, {
      branchMap: PROCUREMENT_BRANCH_MAP,
      departmentMap: PROCUREMENT_DEPARTMENT_MAP,
    });
    expect(payload.Requester).toBeUndefined();
    expect(isMongoObjectIdString(OBJECT_ID)).toBe(true);
  });

  it('uses defaultRequesterCode when user sapRequesterCode is missing', () => {
    const pr = {
      requester: OBJECT_ID,
      department: 'Procurement',
      requiredDate: new Date('2026-05-21'),
      lines: [{ itemCode: 'ITEM1', quantity: 1, warehouseCode: 'WH01' }],
    };
    expect(resolveRequesterSapCode(pr, { defaultRequesterCode: '12' })).toBe('12');
    const payload = mapPrToSap(pr, {
      branchMap: PROCUREMENT_BRANCH_MAP,
      departmentMap: PROCUREMENT_DEPARTMENT_MAP,
      defaultRequesterCode: '12',
    });
    expect(payload.Requester).toBe('12');
  });

  it('formats debug summary with ReqType, DocType, Branch, Requester', () => {
    const payload = mapPrToSap(basePr, {
      branchMap: PROCUREMENT_BRANCH_MAP,
      departmentMap: PROCUREMENT_DEPARTMENT_MAP,
      requesterSapCode: '12',
    });
    const summary = formatSapReferenceSummary(payload, buildPrSapDebugMeta(basePr, payload));
    expect(summary).toMatch(/Requester=12/);
    expect(summary).toMatch(/Branch=-2/);
    expect(summary).toMatch(/ReqType=12/);
    expect(summary).toMatch(/DocType=dDocument_Items/);
    expect(JSON.stringify(summary)).not.toMatch(/password|cookie|B1SESSION/i);
  });
});
