import { apiFetch } from '@/lib/apiClient';

export async function uploadAttachmentFile({
  documentType,
  documentId,
  file,
  approvalStep,
}) {
  const { json: signJson } = await apiFetch('/api/attachments/sign-upload', {
    method: 'POST',
    body: JSON.stringify({
      documentType,
      documentId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    }),
  });
  if (!signJson.success) {
    throw new Error(signJson.message || 'Failed to sign upload');
  }

  const { uploadUrl, s3Key } = signJson.data;
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!putRes.ok) {
    throw new Error('Failed to upload file to storage');
  }

  const { json: metaJson } = await apiFetch('/api/attachments/complete-upload', {
    method: 'POST',
    body: JSON.stringify({
      documentType,
      documentId,
      s3Key,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      approvalStep,
    }),
  });
  if (!metaJson.success) {
    throw new Error(metaJson.message || 'Failed to save attachment');
  }
  return metaJson.data;
}
