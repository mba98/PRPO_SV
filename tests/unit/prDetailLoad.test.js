import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const servicePath = path.resolve(process.cwd(), 'lib/purchaseRequestsService.js');
const prDetailPath = path.resolve(process.cwd(), 'components/purchase-requests/PrDetailView.jsx');

describe('PR detail load regression', () => {
  const serviceSource = fs.readFileSync(servicePath, 'utf8');
  const prDetailSource = fs.readFileSync(prDetailPath, 'utf8');

  it('imports loadPrWorkflow from workflowSteps', () => {
    expect(serviceSource).toMatch(
      /import\s*\{[^}]*loadPrWorkflow[^}]*\}\s*from\s*['"]@\/lib\/workflowSteps\.js['"]/,
    );
    expect(serviceSource).toContain('loadPrWorkflow(pr, user)');
  });

  it('imports buildDocumentApprovalAccess for detail response', () => {
    expect(serviceSource).toMatch(
      /import\s*\{[^}]*buildDocumentApprovalAccess[^}]*\}\s*from\s*['"]@\/lib\/documentApprovalAuth\.js['"]/,
    );
  });

  it('PrDetailView does not import server-only modules', () => {
    expect(prDetailSource).not.toMatch(/purchaseRequestsService/);
    expect(prDetailSource).not.toMatch(/sapRetryAuth/);
    expect(prDetailSource).not.toMatch(/workflowEmailRecipients/);
    expect(prDetailSource).not.toMatch(/from ['"]@\/models\//);
    expect(prDetailSource).not.toMatch(/from ['"]mongoose['"]/);
  });

  it('PrDetailView consumes API-resolved retry flag', () => {
    expect(prDetailSource).toContain('pr.canRetrySap');
  });
});

describe('getPurchaseRequestById', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns workflow steps and canRetrySap without ReferenceError', async () => {
    vi.doMock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
    vi.doMock('@/models/index.js', () => ({}));
    vi.doMock('@/models/PurchaseRequest.js', () => ({
      default: {
        findById: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue({
              _id: '507f1f77bcf86cd799439011',
              portalPRNumber: 'PR-TEST-1',
              status: 'Pending Warehouse Approval',
              currentApprovalStep: 1,
              requester: { _id: 'user1', name: 'Requester', email: 'r@test.com' },
              lines: [],
            }),
          }),
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
    vi.doMock('@/lib/workflowSteps.js', () => ({
      loadPrWorkflow: vi.fn().mockResolvedValue([
        { stepName: 'Warehouse Approval', state: 'current' },
      ]),
    }));
    vi.doMock('@/lib/approvalEngine.js', () => ({
      getApprovalSteps: vi.fn().mockResolvedValue([
        { stepOrder: 1, stepName: 'Warehouse Approval', requiredPermission: 'pr.approve.whs' },
        { stepOrder: 2, stepName: 'PM Approval', requiredPermission: 'pr.approve.pm', isActive: true },
      ]),
      getCurrentStep: vi.fn(),
      getInitialSubmitState: vi.fn(),
      getStateAfterApproval: vi.fn(),
      pendingStatusForStep: vi.fn(),
    }));
    vi.doMock('@/lib/auditHistory.js', () => ({
      getApprovalHistory: vi.fn().mockResolvedValue([]),
      logApprovalHistory: vi.fn(),
    }));
    vi.doMock('@/lib/documentApprovalAuth.js', () => ({
      buildDocumentApprovalAccess: vi.fn().mockReturnValue({
        canApproveCurrentStep: false,
        approveUrl: '/purchase-requests/507f1f77bcf86cd799439011/approve',
      }),
    }));
    vi.doMock('@/lib/sapRetryAuth.js', () => ({
      isDocumentEligibleForSapRetry: vi.fn().mockReturnValue(false),
      canUserRetrySapDocument: vi.fn().mockReturnValue(false),
    }));

    const { getPurchaseRequestById } = await import('@/lib/purchaseRequestsService.js');
    const user = {
      _id: 'user1',
      permissions: ['pr.create'],
      role: { permissions: ['pr.create'] },
    };

    const result = await getPurchaseRequestById('507f1f77bcf86cd799439011', user);

    expect(result).not.toBeNull();
    expect(result.workflowSteps).toHaveLength(1);
    expect(result.canRetrySap).toBe(false);
    expect(result.portalPRNumber).toBe('PR-TEST-1');
  });

  it('returns canRetrySap true for failed SAP when final-step user is authorized', async () => {
    vi.doMock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
    vi.doMock('@/models/index.js', () => ({}));
    vi.doMock('@/models/PurchaseRequest.js', () => ({
      default: {
        findById: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue({
              _id: '507f1f77bcf86cd799439011',
              portalPRNumber: 'PR-FAIL-1',
              status: 'Failed to Create in SAP',
              currentApprovalStep: 2,
              requester: { _id: 'user1', name: 'Requester', email: 'r@test.com' },
              lines: [],
            }),
          }),
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
    vi.doMock('@/models/SapIntegrationLog.js', () => ({
      default: {
        findOne: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              lean: vi.fn().mockResolvedValue(null),
            }),
          }),
        }),
      },
    }));
    vi.doMock('@/lib/workflowSteps.js', () => ({
      loadPrWorkflow: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock('@/lib/approvalEngine.js', () => ({
      getApprovalSteps: vi.fn().mockResolvedValue([
        { stepOrder: 2, stepName: 'PM Approval', requiredPermission: 'pr.approve.pm', isActive: true },
      ]),
      getCurrentStep: vi.fn(),
      getInitialSubmitState: vi.fn(),
      getStateAfterApproval: vi.fn(),
      pendingStatusForStep: vi.fn(),
    }));
    vi.doMock('@/lib/auditHistory.js', () => ({
      getApprovalHistory: vi.fn().mockResolvedValue([]),
      logApprovalHistory: vi.fn(),
    }));
    vi.doMock('@/lib/documentApprovalAuth.js', () => ({
      buildDocumentApprovalAccess: vi.fn().mockReturnValue({ canApproveCurrentStep: false }),
    }));
    vi.doMock('@/lib/sapRetryAuth.js', () => ({
      isDocumentEligibleForSapRetry: vi.fn().mockReturnValue(true),
      canUserRetrySapDocument: vi.fn().mockReturnValue(true),
    }));

    const { getPurchaseRequestById } = await import('@/lib/purchaseRequestsService.js');
    const pmUser = {
      _id: 'pm1',
      permissions: [],
      role: { _id: 'role-pm', name: 'Project Manager', permissions: ['pr.approve.pm'] },
    };

    const result = await getPurchaseRequestById('507f1f77bcf86cd799439011', pmUser);

    expect(result.canRetrySap).toBe(true);
    expect(result.status).toBe('Failed to Create in SAP');
  });

  it('loads rejected PR detail successfully', async () => {
    vi.doMock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
    vi.doMock('@/models/index.js', () => ({}));
    vi.doMock('@/models/PurchaseRequest.js', () => ({
      default: {
        findById: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue({
              _id: '507f1f77bcf86cd799439011',
              portalPRNumber: 'PR-REJ-1',
              status: 'Rejected',
              currentApprovalStep: 0,
              requester: { _id: 'user1', name: 'Requester', email: 'r@test.com' },
              lines: [],
            }),
          }),
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
    vi.doMock('@/lib/workflowSteps.js', () => ({
      loadPrWorkflow: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock('@/lib/approvalEngine.js', () => ({
      getApprovalSteps: vi.fn().mockResolvedValue([]),
      getCurrentStep: vi.fn(),
      getInitialSubmitState: vi.fn(),
      getStateAfterApproval: vi.fn(),
      pendingStatusForStep: vi.fn(),
    }));
    vi.doMock('@/lib/auditHistory.js', () => ({
      getApprovalHistory: vi.fn().mockResolvedValue([{ action: 'Rejected', comment: 'Fix vendor' }]),
      logApprovalHistory: vi.fn(),
    }));
    vi.doMock('@/lib/documentApprovalAuth.js', () => ({
      buildDocumentApprovalAccess: vi.fn().mockReturnValue({ canApproveCurrentStep: false }),
    }));
    vi.doMock('@/lib/sapRetryAuth.js', () => ({
      isDocumentEligibleForSapRetry: vi.fn().mockReturnValue(false),
      canUserRetrySapDocument: vi.fn().mockReturnValue(false),
    }));

    const { getPurchaseRequestById } = await import('@/lib/purchaseRequestsService.js');
    const user = {
      _id: 'user1',
      permissions: ['pr.create'],
      role: { permissions: ['pr.create'] },
    };

    const result = await getPurchaseRequestById('507f1f77bcf86cd799439011', user);

    expect(result.status).toBe('Rejected');
    expect(result.portalPRNumber).toBe('PR-REJ-1');
  });
});
