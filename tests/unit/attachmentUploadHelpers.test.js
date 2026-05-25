import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/uploadClient', () => ({
  uploadAttachmentFile: vi.fn(),
}));

import { uploadAttachmentFile } from '@/lib/uploadClient';
import {
  uploadDocumentAttachments,
  formatAttachmentUploadWarning,
} from '@/lib/attachmentUploadHelpers';

describe('attachmentUploadHelpers', () => {
  it('collects failures without stopping the batch', async () => {
    uploadAttachmentFile
      .mockResolvedValueOnce({ id: '1' })
      .mockRejectedValueOnce(new Error('Storage error'));

    const files = [
      { name: 'a.pdf', type: 'application/pdf', size: 100 },
      { name: 'b.pdf', type: 'application/pdf', size: 100 },
    ];
    const result = await uploadDocumentAttachments({
      documentType: 'PR',
      documentId: '64b8c1a52f5b1b2c3d4e5f60',
      files,
    });
    expect(result.uploaded).toBe(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].fileName).toBe('b.pdf');
  });

  it('formats PR attachment warning message', () => {
    const msg = formatAttachmentUploadWarning(
      [{ fileName: 'scan.pdf', message: 'fail' }],
      'PR',
    );
    expect(msg).toContain('PR was saved');
    expect(msg).toContain('scan.pdf');
    expect(msg).toContain('Attachments tab');
  });
});
