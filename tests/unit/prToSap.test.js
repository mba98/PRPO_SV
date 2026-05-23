import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  buildPrSapDebugMeta,
  formatSapReferenceSummary,
  isInvalidSapOptionalCode,
  isMongoObjectIdString,
  mapPrToSap,
  SAP_PR_REQUIRED_DATE_FIELD,
  validatePrSapPayload,
} from '@/lib/sap/mappers/prToSap';
import { DEV_DEFAULT_SAP_REQUESTER_CODE } from '@/lib/sap/sapRequesterConfig.js';
import { DEV_DEFAULT_WAREHOUSE_CODE } from '@/lib/sap/sapWarehouseConfig.js';

const OBJECT_ID = '507f1f77bcf86cd799439011';

const postmanPr = {
  requiredDate: new Date('2026-05-18'),
  documentDate: new Date('2026-05-18'),
  dueDate: new Date('2026-05-19'),
  remarks: 'Postman vendor test',
  lines: [
    {
      itemCode: 'ALK00004SV',
      vendor: 'V000001',
      quantity: 3,
      warehouseCode: 'RAN004',
      estimatedUnitPrice: 200000,
    },
  ],
};

const baseOptions = {
  requesterSapCode: 'manager',
  defaultRequesterCode: 'manager',
};

describe('prToSap mapper (Postman-aligned)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps ReqType=12', () => {
    const payload = mapPrToSap(postmanPr, baseOptions);
    expect(payload.ReqType).toBe(12);
  });

  it('sends Requester=manager when configured', () => {
    const payload = mapPrToSap(postmanPr, baseOptions);
    expect(payload.Requester).toBe('manager');
    expect(DEV_DEFAULT_SAP_REQUESTER_CODE).toBe('manager');
  });

  it('sends RequriedDate at header level (SAP misspelled field)', () => {
    const payload = mapPrToSap(postmanPr, baseOptions);
    expect(payload.RequriedDate).toBe('2026-05-18');
    expect(SAP_PR_REQUIRED_DATE_FIELD).toBe('RequriedDate');
  });

  it('does not send RequiredDate or ReqDate at header level', () => {
    const payload = mapPrToSap(postmanPr, baseOptions);
    expect(payload.RequiredDate).toBeUndefined();
    expect(payload.ReqDate).toBeUndefined();
  });

  it('sends line RequiredDate', () => {
    const payload = mapPrToSap(postmanPr, baseOptions);
    expect(payload.DocumentLines[0].RequiredDate).toBe('2026-05-18');
  });

  it('maps vendor to LineVendor when provided', () => {
    const payload = mapPrToSap(postmanPr, baseOptions);
    expect(payload.DocumentLines[0].LineVendor).toBe('V000001');
  });

  it('omits LineVendor when vendor is not provided', () => {
    const pr = {
      ...postmanPr,
      lines: [{ itemCode: 'ALK00004SV', quantity: 1, warehouseCode: 'RAN004', estimatedUnitPrice: 1 }],
    };
    const payload = mapPrToSap(pr, baseOptions);
    expect(payload.DocumentLines[0].LineVendor).toBeUndefined();
  });

  it('sends WarehouseCode when provided', () => {
    const payload = mapPrToSap(postmanPr, baseOptions);
    expect(payload.DocumentLines[0].WarehouseCode).toBe('RAN004');
    expect(DEV_DEFAULT_WAREHOUSE_CODE).toBe('RAN004');
  });

  it('uses dev default warehouse RAN004 when line warehouse is missing', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const pr = {
      ...postmanPr,
      lines: [{ itemCode: 'ALK00004SV', quantity: 1, estimatedUnitPrice: 1 }],
    };
    const payload = mapPrToSap(pr, baseOptions);
    expect(payload.DocumentLines[0].WarehouseCode).toBe('RAN004');
  });

  it('does not send DocType by default', () => {
    const payload = mapPrToSap(postmanPr, baseOptions);
    expect(payload.DocType).toBeUndefined();
  });

  it('does not send BPL_IDAssignedToInvoice by default', () => {
    const payload = mapPrToSap(postmanPr, baseOptions);
    expect(payload.BPL_IDAssignedToInvoice).toBeUndefined();
  });

  it('does not send CostingCode or ProjectCode by default', () => {
    const pr = {
      ...postmanPr,
      project: 'PRJ1',
      lines: [
        {
          ...postmanPr.lines[0],
          projectCode: 'PRJ1',
          costCenter: 'Project',
        },
      ],
    };
    const payload = mapPrToSap(pr, baseOptions);
    expect(payload.DocumentLines[0].CostingCode).toBeUndefined();
    expect(payload.DocumentLines[0].ProjectCode).toBeUndefined();
    expect(isInvalidSapOptionalCode('Project')).toBe(true);
  });

  it('does not send U_Department or department fields by default', () => {
    const pr = { ...postmanPr, department: 'Procurement' };
    const payload = mapPrToSap(pr, baseOptions);
    expect(payload.U_Department).toBeUndefined();
    expect(payload.Department).toBeUndefined();
  });

  it('omits Comments when remarks are empty', () => {
    const payload = mapPrToSap({ ...postmanPr, remarks: '' }, baseOptions);
    expect(payload.Comments).toBeUndefined();
  });

  it('sends Comments only when remarks exist', () => {
    const payload = mapPrToSap(postmanPr, baseOptions);
    expect(payload.Comments).toBe('Postman vendor test');
  });

  it('matches the successful Postman payload shape', () => {
    const payload = mapPrToSap(postmanPr, baseOptions);
    expect(payload).toEqual({
      ReqType: 12,
      Requester: 'manager',
      RequriedDate: '2026-05-18',
      DocDate: '2026-05-18',
      DocDueDate: '2026-05-19',
      Comments: 'Postman vendor test',
      DocumentLines: [
        {
          ItemCode: 'ALK00004SV',
          LineVendor: 'V000001',
          Quantity: 3,
          RequiredDate: '2026-05-18',
          WarehouseCode: 'RAN004',
          UnitPrice: 200000,
        },
      ],
    });
  });

  it('uses defaultRequesterCode manager when user sapRequesterCode is missing', () => {
    const pr = {
      ...postmanPr,
      requester: OBJECT_ID,
    };
    const payload = mapPrToSap(pr, { defaultRequesterCode: 'manager' });
    expect(payload.Requester).toBe('manager');
  });

  it('does not send MongoDB ObjectId as Requester', () => {
    const pr = {
      requester: OBJECT_ID,
      requiredDate: new Date('2026-05-18'),
      lines: [{ itemCode: 'ITEM1', quantity: 1, estimatedUnitPrice: 1 }],
    };
    const payload = mapPrToSap(pr, {});
    expect(payload.Requester).toBeUndefined();
    expect(isMongoObjectIdString(OBJECT_ID)).toBe(true);
  });

  it('formats debug summary for failed SAP logs', () => {
    const payload = mapPrToSap(postmanPr, baseOptions);
    const summary = formatSapReferenceSummary(payload, buildPrSapDebugMeta(postmanPr, payload));
    expect(summary).toBe(
      'Requester=manager; ReqType=12; RequriedDate=2026-05-18; Line 1: Item=ALK00004SV, Whs=RAN004, Vendor=V000001, Qty=3, UnitPrice=200000',
    );
    expect(JSON.stringify(summary)).not.toMatch(/password|cookie|B1SESSION/i);
  });

  it('passes validation for Postman-shaped payload', () => {
    const payload = mapPrToSap(postmanPr, baseOptions);
    const validation = validatePrSapPayload(postmanPr, payload, { requesterUsername: 'requester' });
    expect(validation.ok).toBe(true);
  });
});
