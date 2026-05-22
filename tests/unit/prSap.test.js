import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSapPurchaseRequest,
  parseRawSapErrorMessage,
  toUserFriendlySapPrError,
} from '@/lib/sap/prSap';

const findById = vi.fn();
const findByIdUser = vi.fn();
const updateOne = vi.fn();
const logCreate = vi.fn();
const createPR = vi.fn();
const settingsFind = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  connectDB: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/models/PurchaseRequest', () => ({
  default: {
    findById: (...args) => ({
      lean: () => findById(...args),
    }),
    updateOne: (...args) => updateOne(...args),
  },
}));

vi.mock('@/models/User', () => ({
  default: {
    findById: (...args) => ({
      select: () => ({
        lean: () => findByIdUser(...args),
      }),
    }),
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
const USER_ID = '507f1f77bcf86cd799439099';

const basePr = {
  _id: PR_ID,
  portalPRNumber: 'PR-20260521-0001',
  requester: USER_ID,
  department: 'IT',
  requiredDate: new Date('2026-05-21'),
  status: 'Approved',
  lines: [{ itemCode: 'ITEM1', quantity: 1, warehouseCode: 'WH01' }],
};

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
    const result = await createSapPurchaseRequest(PR_ID, { _id: 'u1' });
    expect(result.error).toBe('DUPLICATE_SAP');
    expect(createPR).not.toHaveBeenCalled();
  });

  it('returns SAP_VALIDATION before calling SAP when requester code is missing', async () => {
    findById.mockResolvedValue(basePr);
    findByIdUser.mockResolvedValue({ _id: USER_ID, username: 'requester', sapRequesterCode: null });
    const result = await createSapPurchaseRequest(PR_ID, { _id: 'u1' });
    expect(result.error).toBe('SAP_VALIDATION');
    expect(result.message).toMatch(/Missing SAP requester code for user requester/);
    expect(createPR).not.toHaveBeenCalled();
    expect(logCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Failed',
        requestPayload: expect.objectContaining({
          sap: expect.any(Object),
          debug: expect.objectContaining({ requesterUsername: 'requester' }),
        }),
      }),
    );
  });

  it('calls SAP with resolved requester code and logs success payload', async () => {
    findById.mockResolvedValue(basePr);
    findByIdUser.mockResolvedValue({
      _id: USER_ID,
      username: 'requester',
      sapRequesterCode: 'EMP001',
    });
    createPR.mockResolvedValue({ DocEntry: 10, DocNum: 100 });
    const result = await createSapPurchaseRequest(PR_ID, { _id: 'u1' });
    expect(result.success).toBe(true);
    expect(createPR).toHaveBeenCalledWith(
      expect.objectContaining({ Requester: 'EMP001', DocumentLines: expect.any(Array) }),
    );
    expect(logCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Success',
        requestPayload: expect.objectContaining({ sap: expect.objectContaining({ Requester: 'EMP001' }) }),
      }),
    );
  });

  it('maps ODBC -2028 to a friendly API message while logging raw error', async () => {
    findById.mockResolvedValue(basePr);
    findByIdUser.mockResolvedValue({ username: 'requester', sapRequesterCode: 'EMP001' });
    createPR.mockRejectedValue({
      message: 'Request failed',
      responseBody: {
        error: { message: { value: 'No matching records found (ODBC -2028)' } },
      },
    });
    const result = await createSapPurchaseRequest(PR_ID, { _id: 'u1' });
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
