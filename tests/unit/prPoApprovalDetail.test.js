import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getDictionary } from '@/lib/i18n';

describe('PR/PO detail tab loaders and attachments', () => {
  const attachmentPanel = fs.readFileSync(
    path.resolve(process.cwd(), 'components/attachments/AttachmentPanel.jsx'),
    'utf8',
  );
  const commentsPanel = fs.readFileSync(
    path.resolve(process.cwd(), 'components/comments/CommentsPanel.jsx'),
    'utf8',
  );
  const approvalTimeline = fs.readFileSync(
    path.resolve(process.cwd(), 'components/approval-history/ApprovalTimeline.jsx'),
    'utf8',
  );
  const prDetail = fs.readFileSync(
    path.resolve(process.cwd(), 'components/purchase-requests/PrDetailView.jsx'),
    'utf8',
  );
  const poDetail = fs.readFileSync(
    path.resolve(process.cwd(), 'components/purchase-orders/PoDetailView.jsx'),
    'utf8',
  );

  it('AttachmentPanel uses PortalLoader while loading', () => {
    expect(attachmentPanel).toContain('PortalLoader');
    expect(attachmentPanel).toContain('min-h-[180px]');
    expect(attachmentPanel).not.toContain('AnimatedSkeletonLoader');
  });

  it('CommentsPanel uses PortalLoader while loading', () => {
    expect(commentsPanel).toContain('PortalLoader');
    expect(commentsPanel).toContain('min-h-[180px]');
    expect(commentsPanel).not.toContain('AnimatedSkeletonLoader');
  });

  it('ApprovalTimeline uses PortalLoader while loading', () => {
    expect(approvalTimeline).toContain('PortalLoader');
    expect(approvalTimeline).toContain('min-h-[180px]');
    expect(approvalTimeline).not.toContain('AnimatedSkeletonLoader');
  });

  it('PR detail uses AttachmentPanel for drag-and-drop attachments', () => {
    expect(prDetail).toContain('<AttachmentPanel');
    expect(prDetail).toContain('documentType="PR"');
  });

  it('PO detail uses AttachmentPanel for drag-and-drop attachments', () => {
    expect(poDetail).toContain('<AttachmentPanel');
    expect(poDetail).toContain('documentType="PO"');
  });

  it('PR and PO detail use CommentsPanel and ApprovalTimeline tabs', () => {
    expect(prDetail).toContain('<CommentsPanel');
    expect(prDetail).toContain('<ApprovalTimeline');
    expect(poDetail).toContain('<CommentsPanel');
    expect(poDetail).toContain('<ApprovalTimeline');
  });
});

describe('PR/PO approval forms — shared DocumentApproveForm', () => {
  const sharedForm = fs.readFileSync(
    path.resolve(process.cwd(), 'components/approval/DocumentApproveForm.jsx'),
    'utf8',
  );
  const prWrapper = fs.readFileSync(
    path.resolve(process.cwd(), 'components/purchase-requests/PrApproveForm.jsx'),
    'utf8',
  );
  const poWrapper = fs.readFileSync(
    path.resolve(process.cwd(), 'components/purchase-orders/PoApproveForm.jsx'),
    'utf8',
  );

  it('PR approve wrapper uses shared DocumentApproveForm', () => {
    expect(prWrapper).toContain('DocumentApproveForm');
    expect(prWrapper).toContain('kind="PR"');
  });

  it('PO approve wrapper uses shared DocumentApproveForm', () => {
    expect(poWrapper).toContain('DocumentApproveForm');
    expect(poWrapper).toContain('kind="PO"');
  });

  it('approve button shows loading text while submitting', () => {
    expect(sharedForm).toContain("submittingAction === 'approve'");
    expect(sharedForm).toContain('appr.approving');
    expect(sharedForm).toContain('loading={submittingAction === \'approve\'}');
  });

  it('reject button shows loading text while submitting', () => {
    expect(sharedForm).toContain("submittingAction === 'reject'");
    expect(sharedForm).toContain('appr.rejecting');
    expect(sharedForm).toContain('loading={submittingAction === \'reject\'}');
  });

  it('both buttons disabled while submitting', () => {
    expect(sharedForm).toContain('disabled={!!submittingAction}');
  });

  it('double submit is prevented', () => {
    expect(sharedForm).toContain('if (submittingAction) return');
  });

  it('approval forms use staged AttachmentDropzone', () => {
    expect(sharedForm).toContain('AttachmentDropzone');
    expect(sharedForm).toContain('mode="staged"');
    expect(sharedForm).not.toMatch(/type="file"/);
  });

  it('attachment upload failure after approval shows warning without rollback', () => {
    expect(sharedForm).toContain('uploadDocumentAttachments');
    expect(sharedForm).toContain('if (failures.length)');
    expect(sharedForm).toContain('appr.attachmentUploadWarning');
    expect(sharedForm).toContain('attachmentWarning');
  });

  it('PO approve API paths are configured', () => {
    expect(sharedForm).toContain('/api/purchase-orders');
    expect(sharedForm).toContain("documentType: 'PO'");
  });

  it('PR approve API paths are configured', () => {
    expect(sharedForm).toContain('/api/purchase-requests');
    expect(sharedForm).toContain("documentType: 'PR'");
  });

  it('Arabic and English approval labels exist', () => {
    const ar = getDictionary('ar');
    const en = getDictionary('en');
    expect(ar.approval.approve).toBe('موافقة');
    expect(ar.approval.rejecting).toContain('جاري الرفض');
    expect(ar.approval.attachmentUploadWarning).toContain('تم حفظ الموافقة');
    expect(en.approval.approve).toBe('Approve');
    expect(en.approval.approving).toContain('Approving');
    expect(en.attachments.dragTitle).toContain('Drag files');
    expect(ar.attachments.dragTitle).toContain('اسحب');
  });
});
