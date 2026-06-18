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

  it('accepts custom document type codes', () => {
    const result = createApprovalMatrixSchema.safeParse({
      documentType: 'contract',
      stepOrder: 1,
      stepName: 'Step',
      requiredPermission: 'pr.approve.whs',
      approverRole: validRoleId,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.documentType).toBe('CONTRACT');
    }
  });

  it('defaults completionPolicy to ANY_ONE', () => {
    const result = createApprovalMatrixSchema.safeParse({
      documentType: 'PO',
      stepName: 'PM',
      requiredPermission: 'po.approve.pm',
      approverRole: validRoleId,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.completionPolicy).toBe('ANY_ONE');
    }
  });

  it('rejects unimplemented completion policies in admin UI', () => {
    const result = createApprovalMatrixSchema.safeParse({
      documentType: 'PO',
      stepName: 'PM',
      requiredPermission: 'po.approve.pm',
      approverRole: validRoleId,
      completionPolicy: 'ALL',
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
