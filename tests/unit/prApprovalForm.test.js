import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getDictionary } from '@/lib/i18n';

describe('PR approval form loading and attachments', () => {
  const form = fs.readFileSync(
    path.resolve(process.cwd(), 'components/approval/DocumentApproveForm.jsx'),
    'utf8',
  );
  const button = fs.readFileSync(
    path.resolve(process.cwd(), 'components/ui/Button.jsx'),
    'utf8',
  );

  it('approve button shows loading text while submitting', () => {
    expect(form).toContain("submittingAction === 'approve'");
    expect(form).toContain('appr.approving');
    expect(form).toContain('loading={submittingAction === \'approve\'}');
  });

  it('reject button shows loading text while submitting', () => {
    expect(form).toContain("submittingAction === 'reject'");
    expect(form).toContain('appr.rejecting');
    expect(form).toContain('loading={submittingAction === \'reject\'}');
  });

  it('both buttons disabled while submitting', () => {
    expect(form).toContain('disabled={!!submittingAction}');
    expect(form).toContain('setSubmittingAction');
  });

  it('double submit is prevented', () => {
    expect(form).toContain('if (submittingAction) return');
  });

  it('approval attachment area uses AttachmentDropzone', () => {
    expect(form).toContain('AttachmentDropzone');
    expect(form).toContain('mode="staged"');
    expect(form).not.toMatch(/type="file"/);
  });

  it('dropzone renders drag-and-drop text via i18n', () => {
    expect(form).toContain('att.dragTitle');
    expect(form).toContain('att.dragApprovalHint');
  });

  it('selected file can be removed before submit via dropzone', () => {
    expect(form).toContain('onFilesChange={setFiles}');
    expect(form).toContain('att.removeFile');
  });

  it('approval succeeds with attachment warning when post-upload fails', () => {
    expect(form).toContain('uploadDocumentAttachments');
    expect(form).toContain('if (failures.length)');
    expect(form).toContain('appr.attachmentUploadWarning');
    expect(form).toContain('router.push(detailPath)');
    expect(form).toContain('attachmentWarning');
  });

  it('Arabic approval labels exist', () => {
    const ar = getDictionary('ar');
    expect(ar.approval.approve).toBe('موافقة');
    expect(ar.approval.approving).toContain('جاري الموافقة');
    expect(ar.approval.attachmentUploadWarning).toContain('تم حفظ الموافقة');
    expect(ar.attachments.dragApprovalHint).toContain('اختيارية');
  });

  it('English approval labels exist', () => {
    const en = getDictionary('en');
    expect(en.approval.approve).toBe('Approve');
    expect(en.approval.rejecting).toContain('Rejecting');
    expect(en.approval.attachmentUploadWarning).toContain('Approval was saved');
    expect(en.attachments.removeFile).toBe('Remove');
  });

  it('Button supports loading spinner with visible label', () => {
    expect(button).toContain('loading');
    expect(button).toContain('animate-spin');
    expect(button).toContain('inline-flex');
    expect(button).toContain('gap-2');
  });
});
