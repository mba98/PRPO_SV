import { describe, expect, it } from 'vitest';
import {
  canRetrySapPurchaseRequest,
  isPrApprover,
  limitApprovedTabToOwnRequester,
  PR_POST_APPROVAL_STATUSES,
} from '@/lib/prPermissions';

describe('prPermissions', () => {
  it('allows SAP retry for admin via legacy helper only', () => {
    expect(canRetrySapPurchaseRequest({ permissions: ['view.all'] })).toBe(true);
    expect(canRetrySapPurchaseRequest({ permissions: ['admin.settings'] })).toBe(true);
    expect(
      canRetrySapPurchaseRequest({
        permissions: [],
        role: { permissions: ['pr.approve.pm'] },
      }),
    ).toBe(false);
    expect(
      canRetrySapPurchaseRequest({
        permissions: [],
        role: { permissions: ['pr.approve.whs'] },
      }),
    ).toBe(false);
  });

  it('includes failed SAP in post-approval statuses', () => {
    expect(PR_POST_APPROVAL_STATUSES).toContain('Failed to Create in SAP');
  });

  it('limits approved tab to requester only for plain requesters', () => {
    expect(limitApprovedTabToOwnRequester({ permissions: ['pr.create'] })).toBe(true);
    expect(
      limitApprovedTabToOwnRequester({
        permissions: [],
        role: { permissions: ['pr.approve.pm'] },
      }),
    ).toBe(false);
    expect(limitApprovedTabToOwnRequester({ permissions: ['view.all'] })).toBe(false);
  });

  it('detects PR approver roles', () => {
    expect(isPrApprover({ permissions: ['pr.approve.whs'] })).toBe(true);
    expect(isPrApprover({ permissions: ['pr.create'] })).toBe(false);
  });
});
