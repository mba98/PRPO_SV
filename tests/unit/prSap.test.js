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

vi.mock('@/models/SapIntegrationLog', () => ({
  default: {
    create: (...args) => logCreate(...args),
  },
}));

vi.mock('@/lib/sapServiceLayer.js', () => ({
  createPR: (...args) => createPR(...args),
}));

vi.mock('@/lib/auditHistory.js', () => ({
  logApprovalHistory: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/emailNotify.js', () => ({
  notifyEvent: vi.fn().mockResolvedValue(true),
}));

const PR_ID = '507f1f77bcf86cd799439012';
const REQUESTER_ID = '507f1f77bcf86cd799439099';
const ADMIN_ID = '507f1f77bcf86cd799439088';

const basePr = {
  _id: PR_ID,
  portalPRNumber: 'PR-20260521-0001',
  requester: {
    _id: REQUESTER_ID,
    username: 'requester',
    sapRequesterCode: 'EMP-REQ',
    email: 'requester@portal.local',
  },
  department: 'IT',
  requiredDate: new Date('2026-05-21'),
  status: 'Approved',
  lines: [{ itemCode: 'ITEM1', quantity: 1, warehouseCode: 'WH01' }],
};

const adminUser = { _id: ADMIN_ID, username: 'admin', permissions: ['view.all'] };

describe('createSapPurchaseRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateOne.mockResolvedValue({});
    settingsFind.mockImplementation(({ key }) => {
      if (key === 'branch_map') return Promise.resolve({ value: { IT: 2 } });
      if (key === 'sap_default_requester') return Promise.resolve(null);
      return Promise.resolve(null);
    });
  });

  it('returns DUPLICATE_SAP when sapPRDocEntry already exists', async () => {
    findById.mockResolvedValue({ ...basePr, sapPRDocEntry: 99 });
    const result = await createSapPurchaseRequest(PR_ID, adminUser);
    expect(result.error).toBe('DUPLICATE_SAP');
    expect(createPR).not.toHaveBeenCalled();
  });

  it('retry SAP as admin uses original PR requester sapRequesterCode', async () => {
    findById.mockResolvedValue(basePr);
    createPR.mockResolvedValue({ DocEntry: 10, DocNum: 100 });
    const result = await createSapPurchaseRequest(PR_ID, adminUser);
    expect(result.success).toBe(true);
    expect(createPR).toHaveBeenCalledWith(
      expect.objectContaining({ Requester: 'EMP-REQ' }),
    );
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

  it('does not require admin.sapRequesterCode when admin retries', async () => {
    findById.mockResolvedValue({
      ...basePr,
      requester: { _id: REQUESTER_ID, username: 'requester', sapRequesterCode: 'EMP-REQ' },
    });
    createPR.mockResolvedValue({ DocEntry: 1, DocNum: 1 });
    const result = await createSapPurchaseRequest(PR_ID, {
      _id: ADMIN_ID,
      username: 'admin',
    });
    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
  });

  it('returns validation error for original requester without sapRequesterCode', async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevDefault = process.env.DEFAULT_SAP_REQUESTER_CODE;
    const prevRequester = process.env.SAP_REQUESTER_CODE_REQUESTER;
    process.env.NODE_ENV = 'production';
    delete process.env.DEFAULT_SAP_REQUESTER_CODE;
    delete process.env.SAP_REQUESTER_CODE_REQUESTER;

    findById.mockResolvedValue({
      ...basePr,
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

  it('uses dev default requester code 12 when user sapRequesterCode is missing', async () => {
    findById.mockResolvedValue({
      ...basePr,
      requester: { _id: REQUESTER_ID, username: 'requester', sapRequesterCode: null },
    });
    createPR.mockResolvedValue({ DocEntry: 1, DocNum: 1 });
    const result = await createSapPurchaseRequest(PR_ID, adminUser);
    expect(result.success).toBe(true);
    expect(createPR).toHaveBeenCalledWith(
      expect.objectContaining({ Requester: '12' }),
    );
  });

  it('maps ODBC -2028 to a friendly API message while logging raw error', async () => {
    findById.mockResolvedValue(basePr);
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
