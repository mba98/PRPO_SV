import { describe, expect, it } from 'vitest';
import { canRetrySapPurchaseRequest } from '@/lib/prPermissions';
import { sanitizePr } from '@/lib/purchaseRequestsService';

describe('PR detail SAP fields', () => {
  it('exposes requester SAP code in sanitizePr', () => {
    const out = sanitizePr({
      _id: '507f1f77bcf86cd799439012',
      portalPRNumber: 'PR-1',
      requester: { _id: 'u1', name: 'Requester', sapRequesterCode: 'EMP-REQ' },
      status: 'Failed to Create in SAP',
    });
    expect(out.requesterSapRequesterCode).toBe('EMP-REQ');
  });

  it('allows retry only for admin roles', () => {
    const admin = { permissions: ['view.all'] };
    const pm = { permissions: [], role: { permissions: ['pr.approve.pm'] } };
    expect(canRetrySapPurchaseRequest(admin)).toBe(true);
    expect(canRetrySapPurchaseRequest(pm)).toBe(false);
  });
});
