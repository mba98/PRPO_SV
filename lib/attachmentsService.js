import { randomUUID } from 'crypto';
import '@/models/index.js';
import Attachment from '@/models/Attachment.js';
import { connectDB } from '@/lib/mongodb';
import { buildS3Key, getPresignedPutUrl, getPresignedGetUrl, getMaxFileSizeBytes } from '@/lib/s3.js';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
]);

function safeFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
}

export async function signUpload({ documentType, documentId, fileName, fileType, fileSize }) {
  if (!ALLOWED_MIME.has(fileType)) {
    const err = new Error('File type not allowed');
    err.code = 'INVALID_FILE_TYPE';
    throw err;
  }
  if (fileSize > getMaxFileSizeBytes()) {
    const err = new Error('File exceeds maximum size of 25MB');
    err.code = 'FILE_TOO_LARGE';
    throw err;
  }

  const ulid = randomUUID().replace(/-/g, '');
  const key = buildS3Key(documentType, documentId, ulid, safeFileName(fileName));
  const uploadUrl = await getPresignedPutUrl(key, fileType);
  return { uploadUrl, s3Key: key, ulid };
}

export async function saveAttachmentMetadata({
  documentType,
  documentId,
  s3Key,
  fileName,
  fileType,
  fileSize,
  uploadedBy,
  approvalStep,
}) {
  await connectDB();
  const downloadUrl = await getPresignedGetUrl(s3Key);
  const doc = await Attachment.create({
    documentType,
    documentId,
    s3Key,
    fileName,
    fileType,
    fileSize,
    s3Url: downloadUrl,
    uploadedBy,
    approvalStep,
    uploadedAt: new Date(),
  });
  return {
    id: doc._id.toString(),
    fileName: doc.fileName,
    fileType: doc.fileType,
    fileSize: doc.fileSize,
    downloadUrl,
    uploadedAt: doc.uploadedAt,
  };
}

export async function listAttachments(documentType, documentId) {
  await connectDB();
  const rows = await Attachment.find({ documentType, documentId }).sort({ uploadedAt: -1 }).lean();
  return Promise.all(
    rows.map(async (a) => ({
      id: a._id.toString(),
      fileName: a.fileName,
      fileType: a.fileType,
      fileSize: a.fileSize,
      uploadedAt: a.uploadedAt,
      downloadUrl: await getPresignedGetUrl(a.s3Key),
    })),
  );
}
