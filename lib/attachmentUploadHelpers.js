import { uploadAttachmentFile } from '@/lib/uploadClient';

/**
 * Upload multiple files; collect per-file failures without aborting the batch.
 */
export async function uploadDocumentAttachments({
  documentType,
  documentId,
  files = [],
  approvalStep,
}) {
  const failures = [];
  let uploaded = 0;
  for (const file of files) {
    try {
      await uploadAttachmentFile({
        documentType,
        documentId,
        file,
        approvalStep,
      });
      uploaded += 1;
    } catch (err) {
      failures.push({
        fileName: file.name,
        message: err.message || 'Upload failed',
      });
    }
  }
  return { uploaded, failures };
}

/**
 * User-facing warning when the document was saved but attachments failed.
 */
export function formatAttachmentUploadWarning(failures, documentLabel = 'Document') {
  if (!failures?.length) return '';
  const names = failures.map((f) => f.fileName).filter(Boolean).join(', ');
  const suffix = names ? ` (${names})` : '';
  return `${documentLabel} was saved, but one or more attachments failed to upload${suffix}. You can retry from the Attachments tab.`;
}
