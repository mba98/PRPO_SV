import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const servicePath = path.resolve(process.cwd(), 'lib/purchaseRequestsService.js');
const serviceSource = fs.readFileSync(servicePath, 'utf8');

describe('submitPurchaseRequest resubmit', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('resets to first step, logs Resubmitted, and notifies first approver', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const prDoc = {
      _id: '507f1f77bcf86cd799439011',
      status: 'Rejected',
      currentApprovalStep: 0,
      sapPRDocEntry: null,
      requester: 'user1',
      portalPRNumber: 'PR-1',
      __v: 1,
      save,
    };
    prDoc.toObject = () => prDoc;
    prDoc.populate = vi.fn().mockResolvedValue(prDoc);

    const getInitialSubmitState = vi.fn().mockReturnValue({
      status: 'Pending Warehouse Approval',
      currentApprovalStep: 1,
    });
    const getCurrentStep = vi.fn().mockReturnValue({
      stepName: 'Warehouse Approval',
      stepOrder: 1,
    });
    const logApprovalHistory = vi.fn().mockResolvedValue(undefined);
    const notifyWorkflowEmailSafe = vi.fn().mockResolvedValue(undefined);

    vi.doMock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
    vi.doMock('@/models/index.js', () => ({}));
    vi.doMock('@/models/PurchaseRequest.js', () => ({
      default: {
        findById: vi.fn().mockImplementation(() => {
          prDoc.populate = vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue({
              _id: prDoc._id,
              portalPRNumber: prDoc.portalPRNumber,
              status: prDoc.status,
              currentApprovalStep: prDoc.currentApprovalStep,
              requester: { _id: 'user1', name: 'Requester', email: 'r@test.com' },
              lines: [],
              sapPRDocEntry: null,
            }),
          });
          return prDoc;
        }),
      },
    }));
    vi.doMock('@/models/PurchaseOrder.js', () => ({
      default: {
        find: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([]),
          }),
        }),
      },
    }));
    vi.doMock('@/models/User.js', () => ({ default: {} }));
    vi.doMock('@/models/SapIntegrationLog.js', () => ({ default: {} }));
    vi.doMock('@/lib/approvalEngine.js', () => ({
      getApprovalSteps: vi.fn().mockResolvedValue([
        { stepOrder: 1, stepName: 'Warehouse Approval', isActive: true },
        { stepOrder: 2, stepName: 'PM Approval', isActive: true },
      ]),
      getInitialSubmitState,
      getCurrentStep,
      getStateAfterApproval: vi.fn(),
      pendingStatusForStep: vi.fn(),
    }));
    vi.doMock('@/lib/auditHistory.js', () => ({
      logApprovalHistory,
      getApprovalHistory: vi.fn().mockResolvedValue([
        { action: 'Rejected', comment: 'Fix qty' },
        { action: 'Approved', stepName: 'Warehouse Approval' },
      ]),
    }));
    vi.doMock('@/lib/emailNotify.js', () => ({ notifyWorkflowEmailSafe }));
    vi.doMock('@/lib/emailContext.js', () => ({
      buildPrEmailContext: vi.fn().mockReturnValue({ portalPRNumber: 'PR-1' }),
    }));
    vi.doMock('@/lib/workflowSteps.js', () => ({ loadPrWorkflow: vi.fn().mockResolvedValue([]) }));
    vi.doMock('@/lib/documentApprovalAuth.js', () => ({
      buildDocumentApprovalAccess: vi.fn().mockReturnValue({ canApproveCurrentStep: false }),
    }));
    vi.doMock('@/lib/sapRetryAuth.js', () => ({
      isDocumentEligibleForSapRetry: vi.fn().mockReturnValue(false),
      canUserRetrySapDocument: vi.fn().mockReturnValue(false),
    }));
    vi.doMock('@/lib/prPermissions.js', () => ({
      limitApprovedTabToOwnRequester: vi.fn(),
      PR_POST_APPROVAL_STATUSES: [],
    }));
    vi.doMock('@/lib/prPoReadiness.js', () => ({ enrichPrForPoList: vi.fn().mockReturnValue({}) }));
    vi.doMock('@/lib/poPermissions.js', () => ({ canShowCreatePoAction: vi.fn().mockReturnValue(false) }));

    const { submitPurchaseRequest } = await import('@/lib/purchaseRequestsService.js');
    const user = {
      _id: 'user1',
      roleName: 'Procurement',
      permissions: ['pr.create'],
      role: { permissions: ['pr.create'] },
    };

    const result = await submitPurchaseRequest('507f1f77bcf86cd799439011', user, { __v: 1 });

    expect(getInitialSubmitState).toHaveBeenCalled();
    expect(prDoc.status).toBe('Pending Warehouse Approval');
    expect(prDoc.currentApprovalStep).toBe(1);
    expect(save).toHaveBeenCalled();
    expect(logApprovalHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'Resubmitted',
        previousStatus: 'Rejected',
        newStatus: 'Pending Warehouse Approval',
      }),
    );
    expect(notifyWorkflowEmailSafe).toHaveBeenCalledWith(
      'pr.created',
      expect.any(Object),
      expect.objectContaining({ documentType: 'PR' }),
    );
    expect(result.status).toBe('Pending Warehouse Approval');
    expect(result.canResubmit).toBe(false);
  });

  it('blocks resubmit by non-requester', async () => {
    const prDoc = {
      _id: '507f1f77bcf86cd799439011',
      status: 'Rejected',
      sapPRDocEntry: null,
      requester: 'user1',
      __v: 1,
      toObject: () => prDoc,
    };

    vi.doMock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
    vi.doMock('@/models/index.js', () => ({}));
    vi.doMock('@/models/PurchaseRequest.js', () => ({
      default: { findById: vi.fn().mockResolvedValue(prDoc) },
    }));
    vi.doMock('@/lib/approvalEngine.js', () => ({
      getApprovalSteps: vi.fn(),
      getInitialSubmitState: vi.fn(),
      getCurrentStep: vi.fn(),
    }));
    vi.doMock('@/lib/auditHistory.js', () => ({ logApprovalHistory: vi.fn() }));
    vi.doMock('@/lib/emailNotify.js', () => ({ notifyWorkflowEmailSafe: vi.fn() }));

    const { submitPurchaseRequest } = await import('@/lib/purchaseRequestsService.js');
    const otherUser = { _id: 'user2', roleName: 'Approver', role: { permissions: ['pr.approve.whs'] } };

    await expect(
      submitPurchaseRequest('507f1f77bcf86cd799439011', otherUser, { __v: 1 }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('updatePurchaseRequest protected fields', () => {
  it('uses allow-list field updates instead of findByIdAndUpdate', () => {
    expect(serviceSource).not.toContain('findByIdAndUpdate');
    expect(serviceSource).toContain('normalizeHeader(data)');
    expect(serviceSource).toContain('getPrEditForbiddenMessage');
  });

  it('returns full detail payload after update', () => {
    expect(serviceSource).toMatch(/return getPurchaseRequestById\(id, user\)/);
  });
});

describe('submitPurchaseRequest source', () => {
  it('uses Resubmitted history action for rejected PR', () => {
    expect(serviceSource).toContain("action: isResubmit ? 'Resubmitted' : 'Submitted'");
    expect(serviceSource).toContain('getInitialSubmitState(steps)');
  });
});
