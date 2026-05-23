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
  lines: [
    {
      itemCode: 'ALR00027SV',
      quantity: 100,
      warehouseCode: 'RAN001',
      estimatedUnitPrice: 2222000,
    },
  ],
};

const baseOptions = {
  branchMap: PROCUREMENT_BRANCH_MAP,
  departmentMap: PROCUREMENT_DEPARTMENT_MAP,
  requesterSapCode: '12',
};

describe('prToSap mapper', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps ReqType=12', () => {
    const payload = mapPrToSap(basePr, baseOptions);
    expect(payload.ReqType).toBe(12);
  });

  it('sends Requester="12"', () => {
    const payload = mapPrToSap(basePr, baseOptions);
    expect(payload.Requester).toBe('12');
    expect(normalizeSapRequesterValue('12')).toBe('12');
  });

  it('sends BPL_IDAssignedToInvoice=-2 for Procurement', () => {
    const payload = mapPrToSap(basePr, baseOptions);
    expect(payload.BPL_IDAssignedToInvoice).toBe(-2);
    expect(resolveBranchId('Procurement', PROCUREMENT_BRANCH_MAP)).toBe(-2);
  });

  it('sends DocType=dDocument_Items', () => {
    const payload = mapPrToSap(basePr, baseOptions);
    expect(payload.DocType).toBe('dDocument_Items');
    expect(SAP_PR_DOC_TYPE).toBe('dDocument_Items');
  });

  it('sends only simplified line fields by default (Item, Qty, UnitPrice, RequiredDate)', () => {
    const payload = mapPrToSap(basePr, baseOptions);
    const line = payload.DocumentLines[0];
    expect(line.ItemCode).toBe('ALR00027SV');
    expect(line.Quantity).toBe(100);
    expect(line.UnitPrice).toBe(2222000);
    expect(Object.keys(line).sort()).toEqual(['ItemCode', 'Quantity', 'RequiredDate', 'UnitPrice']);
  });

  it('does not send WarehouseCode by default even when warehouseCode is provided', () => {
    const payload = mapPrToSap(basePr, baseOptions);
    expect(payload.DocumentLines[0].WarehouseCode).toBeUndefined();
  });

  it('does not send WarehouseCode when warehouseCode is missing or a default UI value', () => {
    const pr = {
      ...basePr,
      lines: [
        { itemCode: 'A1', quantity: 1, estimatedUnitPrice: 1 },
        { itemCode: 'A2', quantity: 1, estimatedUnitPrice: 1, warehouseCode: '' },
        { itemCode: 'A3', quantity: 1, estimatedUnitPrice: 1, warehouseCode: '—' },
      ],
    };
    const payload = mapPrToSap(pr, baseOptions);
    expect(payload.DocumentLines[0].WarehouseCode).toBeUndefined();
    expect(payload.DocumentLines[1].WarehouseCode).toBeUndefined();
    expect(payload.DocumentLines[2].WarehouseCode).toBeUndefined();
  });

  it('does not send CostingCode by default for placeholder cost centers (Retail/Project)', () => {
    const pr = {
      ...basePr,
      lines: [
        { itemCode: 'A1', quantity: 1, estimatedUnitPrice: 1, costCenter: 'Retail' },
        { itemCode: 'A2', quantity: 1, estimatedUnitPrice: 1, costCenter: 'Project' },
      ],
    };
    const payload = mapPrToSap(pr, baseOptions);
    expect(isInvalidSapOptionalCode('Retail')).toBe(true);
    expect(isInvalidSapOptionalCode('Project')).toBe(true);
    expect(payload.DocumentLines[0].CostingCode).toBeUndefined();
    expect(payload.DocumentLines[1].CostingCode).toBeUndefined();
  });

  it('does not send CostingCode when cost center is empty or dash', () => {
    const pr = {
      ...basePr,
      lines: [
        { itemCode: 'A1', quantity: 1, estimatedUnitPrice: 1, costCenter: '-' },
        { itemCode: 'A2', quantity: 1, estimatedUnitPrice: 1, costCenter: '' },
      ],
    };
    const payload = mapPrToSap(pr, baseOptions);
    expect(payload.DocumentLines[0].CostingCode).toBeUndefined();
    expect(payload.DocumentLines[1].CostingCode).toBeUndefined();
  });

  it('does not send U_Department by default', () => {
    const payload = mapPrToSap(basePr, baseOptions);
    expect(payload.U_Department).toBeUndefined();
  });

  it('does not send U_DelDate or U_Rate by default', () => {
    const pr = {
      ...basePr,
      lines: [
        {
          itemCode: 'A1',
          quantity: 1,
          estimatedUnitPrice: 1,
          uDelDate: new Date('2026-06-01'),
          uRate: 1.2,
        },
      ],
    };
    const payload = mapPrToSap(pr, baseOptions);
    expect(payload.DocumentLines[0].U_DelDate).toBeUndefined();
    expect(payload.DocumentLines[0].U_Rate).toBeUndefined();
  });

  it('omits Comments when there are no remarks', () => {
    const payload = mapPrToSap(basePr, baseOptions);
    expect(payload.Comments).toBeUndefined();
  });

  it('sends Comments only when remarks exist', () => {
    const payload = mapPrToSap({ ...basePr, remarks: 'Urgent order' }, baseOptions);
    expect(payload.Comments).toBe('Urgent order');
  });

  it('opts in to reference fields only when explicitly requested and valid', () => {
    const pr = {
      ...basePr,
      lines: [
        {
          itemCode: 'A1',
          quantity: 1,
          estimatedUnitPrice: 1,
          warehouseCode: 'WH01',
          projectCode: 'P1',
          costCenter: 'CC1',
        },
      ],
    };
    const payload = mapPrToSap(pr, {
      ...baseOptions,
      includeWarehouseCode: true,
      includeProjectCode: true,
      includeCostingCode: true,
      includeUdfs: true,
    });
    const line = payload.DocumentLines[0];
    expect(line.WarehouseCode).toBe('WH01');
    expect(line.ProjectCode).toBe('P1');
    expect(line.CostingCode).toBe('CC1');
    expect(payload.U_Department).toBe('General');
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

  it('passes validation without WarehouseCode (no longer required)', () => {
    const payload = mapPrToSap(basePr, baseOptions);
    const validation = validatePrSapPayload(basePr, payload, { requesterUsername: 'requester' });
    expect(validation.ok).toBe(true);
    expect(validation.errors).toHaveLength(0);
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
      lines: [{ itemCode: 'ITEM1', quantity: 1, estimatedUnitPrice: 1 }],
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
      lines: [{ itemCode: 'ITEM1', quantity: 1, estimatedUnitPrice: 1 }],
    };
    expect(resolveRequesterSapCode(pr, { defaultRequesterCode: '12' })).toBe('12');
    const payload = mapPrToSap(pr, {
      branchMap: PROCUREMENT_BRANCH_MAP,
      departmentMap: PROCUREMENT_DEPARTMENT_MAP,
      defaultRequesterCode: '12',
    });
    expect(payload.Requester).toBe('12');
  });

  it('formats debug summary with Requester, Branch, ReqType, DocType, and line Item/Qty/UnitPrice', () => {
    const payload = mapPrToSap(basePr, baseOptions);
    const summary = formatSapReferenceSummary(payload, buildPrSapDebugMeta(basePr, payload));
    expect(summary).toMatch(/Requester=12/);
    expect(summary).toMatch(/Branch=-2/);
    expect(summary).toMatch(/ReqType=12/);
    expect(summary).toMatch(/DocType=dDocument_Items/);
    expect(summary).toMatch(/Line 1: Item=ALR00027SV, Qty=100, UnitPrice=2222000/);
    // Reference fields that are no longer sent must not appear in the summary.
    expect(summary).not.toMatch(/Whs=/);
    expect(summary).not.toMatch(/CostCenter=/);
    expect(JSON.stringify(summary)).not.toMatch(/password|cookie|B1SESSION/i);
  });
});
