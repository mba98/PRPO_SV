import { beforeEach, describe, expect, it, vi } from 'vitest';

const logCreate = vi.fn().mockResolvedValue({});
const findById = vi.fn();
const updateOne = vi.fn().mockResolvedValue({});

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(true) }));
vi.mock('@/lib/sap/sapIntegrationLog.js', () => ({
  writeSapIntegrationLog: (...args) => logCreate(...args),
  logSapDuplicateGuard: (...args) => logCreate(...args),
}));
vi.mock('@/lib/sapServiceLayer.js', () => ({
  createPR: vi.fn(),
  createPO: vi.fn(),
  createAPReserveInvoice: vi.fn(),
}));
vi.mock('@/lib/auditHistory.js', () => ({ logApprovalHistory: vi.fn() }));
vi.mock('@/lib/emailNotify.js', () => ({ notifyWorkflowEmailSafe: vi.fn() }));

vi.mock('@/models/PurchaseRequest.js', () => ({
  default: {
    findById: () => ({ populate: () => ({ lean: () => findById() }) }),
    updateOne: (...a) => updateOne(...a),
  },
}));

vi.mock('@/models/PurchaseOrder.js', () => ({
  default: {
    findById: vi.fn(),
    updateOne: (...a) => updateOne(...a),
  },
}));

vi.mock('@/models/APReserveInvoice.js', () => ({
  default: {
    findById: vi.fn(),
    updateOne: (...a) => updateOne(...a),
  },
}));

vi.mock('@/models/SystemSettings.js', () => ({
  default: { findOne: () => ({ lean: () => Promise.resolve(null) }) },
}));

import { createPR } from '@/lib/sapServiceLayer.js';
import { createPO } from '@/lib/sapServiceLayer.js';
import { createAPReserveInvoice } from '@/lib/sapServiceLayer.js';
import { createSapPurchaseRequest } from '@/lib/sap/prSap.js';
import { createSapPurchaseOrder } from '@/lib/sap/poSap.js';
import { createSapApReserveInvoice } from '@/lib/sap/apriSap.js';
import PurchaseOrder from '@/models/PurchaseOrder.js';
import APReserveInvoice from '@/models/APReserveInvoice.js';

const PR_ID = '507f1f77bcf86cd799439011';
const PO_ID = '507f1f77bcf86cd799439012';
const APRI_ID = '507f1f77bcf86cd799439013';

describe('SAP duplicate guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prevents SAP PR creation when sapPRDocEntry exists', async () => {
    findById.mockResolvedValue({
      _id: PR_ID,
      portalPRNumber: 'PR-1',
      sapPRDocEntry: 10,
      sapPRDocNum: '100',
      status: 'Approved',
      lines: [],
    });
    const result = await createSapPurchaseRequest(PR_ID, { username: 'admin' });
    expect(result.error).toBe('DUPLICATE_SAP');
    expect(createPR).not.toHaveBeenCalled();
    expect(logCreate).toHaveBeenCalled();
  });

  it('prevents SAP PO creation when sapPODocEntry exists', async () => {
    PurchaseOrder.findById.mockResolvedValue({
      _id: PO_ID,
      portalPONumber: 'PO-1',
      sapPODocEntry: 20,
      sapPODocNum: '200',
      status: 'Approved',
      lines: [],
      toObject: () => ({ lines: [] }),
    });
    const result = await createSapPurchaseOrder(PO_ID, { username: 'admin' });
    expect(result.error).toBe('DUPLICATE_SAP');
    expect(createPO).not.toHaveBeenCalled();
  });

  it('prevents APRI creation when sapAPDocEntry exists', async () => {
    APReserveInvoice.findById.mockResolvedValue({
      _id: APRI_ID,
      portalAPNumber: 'AP-1',
      sapAPDocEntry: 30,
      sapAPDocNum: '300',
      status: 'Draft',
      lines: [],
      toObject: () => ({ lines: [], vendor: 'V1', relatedSAPPODocEntry: 20 }),
    });
    const result = await createSapApReserveInvoice(APRI_ID, { username: 'admin' });
    expect(result.error).toBe('DUPLICATE_SAP');
    expect(createAPReserveInvoice).not.toHaveBeenCalled();
  });
});
