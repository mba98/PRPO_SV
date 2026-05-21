import { describe, expect, it } from 'vitest';
import {
  createApprovalMatrixSchema,
  updateApprovalMatrixSchema,
} from '@/lib/validators/approvalMatrix';

const validRoleId = '507f1f77bcf86cd799439011';

describe('createApprovalMatrixSchema', () => {
  it('accepts valid PR step', () => {
    const result = createApprovalMatrixSchema.safeParse({
      documentType: 'PR',
      stepOrder: 1,
      stepName: 'Warehouse Approval',
      requiredPermission: 'pr.approve.whs',
      approverRole: validRoleId,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid document type', () => {
    const result = createApprovalMatrixSchema.safeParse({
      documentType: 'INV',
      stepOrder: 1,
      stepName: 'Step',
      requiredPermission: 'pr.approve.whs',
      approverRole: validRoleId,
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-positive step order', () => {
    const result = createApprovalMatrixSchema.safeParse({
      documentType: 'PO',
      stepOrder: 0,
      stepName: 'Step',
      requiredPermission: 'po.approve.pm',
      approverRole: validRoleId,
    });
    expect(result.success).toBe(false);
  });
});

describe('updateApprovalMatrixSchema', () => {
  it('allows toggling isActive', () => {
    const result = updateApprovalMatrixSchema.safeParse({ isActive: false });
    expect(result.success).toBe(true);
  });
});
