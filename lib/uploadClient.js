import { apiFetch } from '@/lib/apiClient';

async function putFileToStorage(uploadUrl, file) {
  try {
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!putRes.ok) {
      throw new Error(`Failed to upload file to storage (${putRes.status})`);
    }
  } catch (err) {
    if (err?.message === 'Failed to fetch') {
      throw new Error(
        'Failed to upload file to storage — network or CORS error contacting cloud storage',
      );
    }
    throw err;
  }
}

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
  await putFileToStorage(uploadUrl, file);

  const { json: metaJson } = await apiFetch('/api/attachments/complete-upload', {
    method: 'POST',
    body: JSON.stringify({
      documentType,
      documentId,
      s3Key,
      fileName: file.name,
      originalFileName: file.name,
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
