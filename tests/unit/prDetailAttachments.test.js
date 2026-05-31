import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getDictionary } from '@/lib/i18n';

describe('PR detail tab loaders and attachments UI', () => {
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
  const dropzone = fs.readFileSync(
    path.resolve(process.cwd(), 'components/attachments/AttachmentDropzone.jsx'),
    'utf8',
  );
  const portalLoader = fs.readFileSync(
    path.resolve(process.cwd(), 'components/ui/PortalLoader.jsx'),
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

  it('AttachmentPanel renders drag-and-drop upload area', () => {
    expect(attachmentPanel).toContain('AttachmentDropzone');
    expect(attachmentPanel).toContain('mode="immediate"');
    expect(attachmentPanel).toContain('border-dashed');
    expect(attachmentPanel).toContain('rounded-3xl');
  });

  it('AttachmentDropzone supports immediate mode', () => {
    expect(dropzone).toContain("mode = 'staged'");
    expect(dropzone).toContain("mode === 'immediate'");
    expect(dropzone).toContain('onUploadFiles');
  });

  it('upload success refreshes attachment list', () => {
    expect(attachmentPanel).toContain('setListVersion');
    expect(attachmentPanel).toContain('uploadAttachmentFile');
    expect(attachmentPanel).toContain('await load()');
  });

  it('Arabic attachment labels exist', () => {
    const ar = getDictionary('ar');
    expect(ar.attachments.dragTitle).toContain('اسحب');
    expect(ar.attachments.noAttachmentsTitle).toContain('مرفقات');
    expect(ar.attachments.open).toBe('فتح');
  });

  it('English attachment labels exist', () => {
    const en = getDictionary('en');
    expect(en.attachments.dragTitle).toContain('Drag files');
    expect(en.attachments.noAttachmentsDescription).toContain('Upload supporting');
    expect(en.attachments.download).toBe('Download');
  });

  it('PortalLoader is text-only without card wrapper', () => {
    expect(portalLoader).toContain('portal-loader-text');
    expect(portalLoader).not.toContain('portal-loader-card');
    expect(portalLoader).not.toContain('AnimatedSkeletonLoader');
  });
});
