import { describe, expect, it } from 'vitest';
import { sanitizePr } from '@/lib/purchaseRequestsService';

describe('purchase request API helpers', () => {
  it('sanitizes mongoose document for API envelope', () => {
    const raw = {
      _id: '507f1f77bcf86cd799439011',
      portalPRNumber: 'PR-20260521-0001',
      requester: { _id: '507f1f77bcf86cd799439012', name: 'Admin', email: 'a@test.com' },
      department: 'Ops',
      status: 'Draft',
      currentApprovalStep: 0,
      lines: [{ itemCode: 'X', quantity: 1 }],
      __v: 0,
    };
    const out = sanitizePr(raw);
    expect(out.id).toBe('507f1f77bcf86cd799439011');
    expect(out.portalPRNumber).toBe('PR-20260521-0001');
    expect(out.requesterName).toBe('Admin');
    expect(out.lines).toHaveLength(1);
  });
});
