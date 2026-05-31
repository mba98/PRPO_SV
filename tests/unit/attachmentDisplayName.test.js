import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  isBlankDisplayFileName,
  resolveAttachmentDisplayName,
} from '@/lib/attachmentDisplayName';

describe('resolveAttachmentDisplayName', () => {
  it('prefers originalFileName with Arabic characters', () => {
    const name = resolveAttachmentDisplayName({
      originalFileName: 'صورة الفاتورة.png',
      fileName: '.png',
    });
    expect(name).toBe('صورة الفاتورة.png');
  });

  it('never returns a blank display name', () => {
    expect(
      resolveAttachmentDisplayName({ fileName: '.png', fileType: 'image/png' }, {
        fallbackLabel: 'Attachment',
      }),
    ).toBe('Attachment.png');
    expect(
      resolveAttachmentDisplayName({ fileName: 'file' }, { fallbackLabel: 'ملف مرفق' }),
    ).toBe('ملف مرفق');
  });

  it('does not treat sanitized storage-only names as display when original exists', () => {
    expect(isBlankDisplayFileName('.png')).toBe(true);
    expect(isBlankDisplayFileName('attachment-01HXXXY.png')).toBe(false);
  });
});

describe('AttachmentPanel display', () => {
  it('uses resolveAttachmentDisplayName and dir auto for filenames', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'components/attachments/AttachmentPanel.jsx'),
      'utf8',
    );
    expect(source).toContain('resolveAttachmentDisplayName');
    expect(source).toContain('dir="auto"');
    expect(source).toContain('break-words');
  });
});
