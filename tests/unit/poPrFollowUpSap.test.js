import { beforeEach, describe, expect, it, vi } from 'vitest';

const slMocks = vi.hoisted(() => ({
  getPurchaseRequest: vi.fn(),
  patchPurchaseRequest: vi.fn(),
  closePurchaseRequest: vi.fn(),
}));

vi.mock('@/lib/sapServiceLayer.js', () => ({
  getPurchaseRequest: slMocks.getPurchaseRequest,
  patchPurchaseRequest: slMocks.patchPurchaseRequest,
  closePurchaseRequest: slMocks.closePurchaseRequest,
}));

vi.mock('@/models/SapIntegrationLog.js', () => ({
  default: { create: vi.fn().mockResolvedValue({}) },
}));

import {
  appendSapPurchaseRequestComment,
  closeSapPurchaseRequestAfterPo,
  followUpSapPrAfterPoCreation,
} from '@/lib/sap/poPrFollowUpSap';

describe('poPrFollowUpSap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    slMocks.getPurchaseRequest.mockResolvedValue({ Comments: 'Existing PR note' });
    slMocks.patchPurchaseRequest.mockResolvedValue({ DocEntry: 42 });
    slMocks.closePurchaseRequest.mockResolvedValue({});
  });

  it('appends to existing SAP PR comments', async () => {
    await appendSapPurchaseRequestComment(42, 'PO reference', { portalPrId: 'pr1' });
    expect(slMocks.patchPurchaseRequest).toHaveBeenCalledWith(42, {
      Comments: 'Existing PR note\nPO reference',
    });
  });

  it('collects warning when PR comment update fails but continues', async () => {
    slMocks.getPurchaseRequest.mockRejectedValue(new Error('read failed'));
    const result = await followUpSapPrAfterPoCreation({
      sapPRDocEntry: 42,
      sapPODocEntry: 99,
      sapPODocNum: '500',
      portalPrId: 'pr1',
    });
    expect(result.warnings.some((w) => w.includes('comment'))).toBe(true);
    expect(slMocks.closePurchaseRequest).toHaveBeenCalled();
  });

  it('collects warning when PR close fails', async () => {
    slMocks.closePurchaseRequest.mockRejectedValue(new Error('close failed'));
    const result = await closeSapPurchaseRequestAfterPo(42, { portalPrId: 'pr1' });
    expect(result.ok).toBe(false);
    expect(result.warning).toContain('could not be closed');
  });
});
