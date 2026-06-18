import { describe, expect, it } from 'vitest';
import { sanitizeApprovalMatrixStep } from '@/lib/approvalMatrixService.js';

describe('sanitizeApprovalMatrixStep completionPolicy', () => {
  it('defaults missing completionPolicy to ANY_ONE', () => {
    const sanitized = sanitizeApprovalMatrixStep({
      _id: 'step1',
      documentType: 'PO',
      stepOrder: 1,
      stepName: 'Project Manager Approval',
      requiredPermission: 'po.approve.pm',
      approverRole: { _id: 'role1', name: 'Project Manager' },
      isActive: true,
    });
    expect(sanitized.completionPolicy).toBe('ANY_ONE');
  });

  it('preserves explicit completionPolicy', () => {
    const sanitized = sanitizeApprovalMatrixStep({
      _id: 'step1',
      documentType: 'PO',
      stepOrder: 1,
      stepName: 'PM',
      requiredPermission: 'po.approve.pm',
      approverRole: { _id: 'role1', name: 'Project Manager' },
      completionPolicy: 'ANY_ONE',
      minimumApprovalCount: null,
      isActive: true,
    });
    expect(sanitized.completionPolicy).toBe('ANY_ONE');
    expect(sanitized.minimumApprovalCount).toBeNull();
  });
});
