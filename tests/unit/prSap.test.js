import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSapPurchaseRequest,
  parseRawSapErrorMessage,
  toUserFriendlySapPrError,
} from '@/lib/sap/prSap';

const findById = vi.fn();
const updateOne = vi.fn();
const logCreate = vi.fn();
const createPR = vi.fn();
const settingsFind = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  connectDB: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/models/PurchaseRequest', () => ({
  default: {
    findById: () => ({
      populate: () => ({
        lean: () => findById(),
      }),
    }),
    updateOne: (...args) => updateOne(...args),
  },
}));

vi.mock('@/models/SystemSettings', () => ({
  default: {
    findOne: (...args) => ({
      lean: () => settingsFind(...args),
    }),
  },
}));

vi.mock('@/lib/sap/sapIntegrationLog.js', () => ({
  writeSapIntegrationLog: (...args) => logCreate(...args),
  logSapDuplicateGuard: (...args) => logCreate(...args),
}));

vi.mock('@/lib/sapServiceLayer.js', () => ({
  createPR: (...args) => createPR(...args),
}));

vi.mock('@/lib/auditHistory.js', () => ({
  logApprovalHistory: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/emailNotify.js', () => ({
  notifyEvent: vi.fn().mockResolvedValue(true),
  notifyWorkflowEmailSafe: vi.fn(),
}));

const PR_ID = '507f1f77bcf86cd799439012';
const REQUESTER_ID = '507f1f77bcf86cd799439099';
const ADMIN_ID = '507f1f77bcf86cd799439088';

const postmanPr = {
  _id: PR_ID,
  portalPRNumber: 'PR-20260522-0003',
  requester: {
    _id: REQUESTER_ID,
    username: 'requester',
    sapRequesterCode: 'manager',
    email: 'requester@portal.local',
  },
  requiredDate: new Date('2026-05-18'),
  documentDate: new Date('2026-05-18'),
  dueDate: new Date('2026-05-19'),
  remarks: 'Postman vendor test',
  status: 'Approved',
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

const adminUser = { _id: ADMIN_ID, username: 'admin', permissions: ['view.all'] };

describe('createSapPurchaseRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateOne.mockResolvedValue({});
    settingsFind.mockResolvedValue(null);
  });

  it('returns DUPLICATE_SAP when sapPRDocEntry already exists', async () => {
    findById.mockResolvedValue({ ...postmanPr, sapPRDocEntry: 49 });
    const result = await createSapPurchaseRequest(PR_ID, adminUser);
    expect(result.error).toBe('DUPLICATE_SAP');
    expect(createPR).not.toHaveBeenCalled();
  });

  it('posts Postman-aligned payload on SAP create', async () => {
    findById.mockResolvedValue(postmanPr);
    createPR.mockResolvedValue({ DocEntry: 49, DocNum: 2600007, DocType: 'dDocument_Items' });
    const result = await createSapPurchaseRequest(PR_ID, adminUser);
    expect(result.success).toBe(true);
    expect(createPR).toHaveBeenCalledWith({
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
    expect(createPR.mock.calls[0][0].DocType).toBeUndefined();
    expect(createPR.mock.calls[0][0].BPL_IDAssignedToInvoice).toBeUndefined();
  });

  it('retry SAP as admin uses original PR requester sapRequesterCode', async () => {
    findById.mockResolvedValue(postmanPr);
    createPR.mockResolvedValue({ DocEntry: 49, DocNum: 2600007 });
    await createSapPurchaseRequest(PR_ID, adminUser);
    expect(createPR).toHaveBeenCalledWith(expect.objectContaining({ Requester: 'manager' }));
    expect(logCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        requestPayload: expect.objectContaining({
          debug: expect.objectContaining({
            requesterUsername: 'requester',
            actionPerformedBy: 'admin',
          }),
        }),
      }),
    );
  });

  it('returns validation error for original requester without sapRequesterCode in production', async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevDefault = process.env.DEFAULT_SAP_REQUESTER_CODE;
    const prevRequester = process.env.SAP_REQUESTER_CODE_REQUESTER;
    process.env.NODE_ENV = 'production';
    delete process.env.DEFAULT_SAP_REQUESTER_CODE;
    delete process.env.SAP_REQUESTER_CODE_REQUESTER;

    findById.mockResolvedValue({
      ...postmanPr,
      requester: { _id: REQUESTER_ID, username: 'requester', sapRequesterCode: null },
    });
    const result = await createSapPurchaseRequest(PR_ID, adminUser);
    process.env.NODE_ENV = prevNodeEnv;
    if (prevDefault !== undefined) process.env.DEFAULT_SAP_REQUESTER_CODE = prevDefault;
    else delete process.env.DEFAULT_SAP_REQUESTER_CODE;
    if (prevRequester !== undefined) process.env.SAP_REQUESTER_CODE_REQUESTER = prevRequester;
    else delete process.env.SAP_REQUESTER_CODE_REQUESTER;

    expect(result.error).toBe('SAP_VALIDATION');
    expect(result.message).toMatch(/Missing SAP requester code for PR requester requester/);
    expect(createPR).not.toHaveBeenCalled();
  });

  it('uses dev default requester manager when user sapRequesterCode is missing', async () => {
    findById.mockResolvedValue({
      ...postmanPr,
      requester: { _id: REQUESTER_ID, username: 'requester', sapRequesterCode: null },
    });
    createPR.mockResolvedValue({ DocEntry: 49, DocNum: 2600007 });
    const result = await createSapPurchaseRequest(PR_ID, adminUser);
    expect(result.success).toBe(true);
    expect(createPR).toHaveBeenCalledWith(expect.objectContaining({ Requester: 'manager' }));
  });

  it('maps ODBC -2028 to a friendly API message while logging raw error', async () => {
    findById.mockResolvedValue(postmanPr);
    createPR.mockRejectedValue({
      message: 'Request failed',
      responseBody: {
        error: { message: { value: 'No matching records found (ODBC -2028)' } },
      },
    });
    const result = await createSapPurchaseRequest(PR_ID, adminUser);
    expect(result.error).toBe('SAP_FAILED');
    expect(result.message).toMatch(/referenced codes/);
    expect(logCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Failed',
        errorMessage: 'No matching records found (ODBC -2028)',
      }),
    );
  });
});

describe('SAP PR error helpers', () => {
  it('parses raw ODBC message from Service Layer body', () => {
    const raw = parseRawSapErrorMessage({
      responseBody: { error: { message: { value: 'No matching records found (ODBC -2028)' } } },
    });
    expect(raw).toContain('ODBC -2028');
  });

  it('returns user-friendly message for ODBC -2028', () => {
    const friendly = toUserFriendlySapPrError('No matching records found (ODBC -2028)');
    expect(friendly).toMatch(/referenced codes/);
    expect(friendly).not.toContain('ODBC -2028');
  });
});
