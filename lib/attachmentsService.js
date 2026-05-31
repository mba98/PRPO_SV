import { randomBytes } from 'crypto';
import mongoose from 'mongoose';
import '@/models/index.js';
import Attachment from '@/models/Attachment.js';
import { connectDB } from '@/lib/mongodb';
import {
  buildS3Key,
  getPresignedPutUrl,
  getPresignedGetUrl,
  getMaxFileSizeBytes,
} from '@/lib/s3.js';
import { assertCanAccessDocument } from '@/lib/documentAccess.js';
import { logApprovalHistory } from '@/lib/auditHistory.js';

export const ALLOWED_MIME_TYPES = Object.freeze([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
]);

const ALLOWED_MIME = new Set(ALLOWED_MIME_TYPES);
const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function badRequest(message, code) {
  const err = new Error(message);
  err.code = code;
  err.status = 400;
  return err;
}

function fileExtensionSegment(name) {
  if (!name) return '';
  const base = String(name)
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .trim();
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return '';
  return base.slice(dot);
}

/**
 * Strip directory parts and reserved characters from a user-provided file name (S3 storage only).
 */
export function safeFileName(name) {
  if (!name) return 'file';
  const base = String(name)
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .trim();
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '');
  const trimmed = cleaned.slice(0, 200);
  if (!trimmed || !/[a-zA-Z0-9]/.test(trimmed)) return 'file';
  return trimmed;
}

/**
 * Safe object key segment; falls back to attachment-{ulid}.ext when Latin sanitization empties the name.
 */
export function safeStorageFileName(originalName, ulid) {
  const ext = fileExtensionSegment(originalName);
  const safe = safeFileName(originalName);
  if (safe === 'file' || !/[a-zA-Z0-9]/.test(safe.replace(ext, ''))) {
    return `attachment-${ulid}${ext}`;
  }
  return safe;
}

/**
 * Preserve the user-visible file name (including Arabic) for DB display fields.
 */
export function normalizeDisplayFileName(name) {
  const base = String(name || '')
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .trim();
  return base.slice(0, 255) || 'attachment';
}

/**
 * Crockford-base32 ULID-ish id: time-prefixed, 26 chars, lexicographically sortable.
 */
export function newUlid(now = Date.now()) {
  let timePart = '';
  let t = now;
  for (let i = 0; i < 10; i += 1) {
    timePart = ULID_ALPHABET[t % 32] + timePart;
    t = Math.floor(t / 32);
  }
  const bytes = randomBytes(16);
  let randomPart = '';
  for (let i = 0; i < 16; i += 1) {
    randomPart += ULID_ALPHABET[bytes[i] % 32];
  }
  return timePart + randomPart;
}

export function isAllowedMime(fileType) {
  return ALLOWED_MIME.has(fileType);
}

/**
 * Normalize document id for consistent MongoDB ObjectId queries.
 */
export function normalizeDocumentId(documentId) {
  if (!documentId) return documentId;
  const str = String(documentId);
  if (mongoose.Types.ObjectId.isValid(str)) {
    return new mongoose.Types.ObjectId(str);
  }
  return documentId;
}

function assertFileMeta({ fileType, fileSize }) {
  if (!isAllowedMime(fileType)) {
    throw badRequest('File type not allowed', 'INVALID_FILE_TYPE');
  }
  const size = Number(fileSize);
  if (!Number.isFinite(size) || size <= 0) {
    throw badRequest('File size must be greater than zero', 'INVALID_FILE_SIZE');
  }
  if (size > getMaxFileSizeBytes()) {
    throw badRequest('File exceeds maximum size of 25MB', 'FILE_TOO_LARGE');
  }
}

/**
 * Step 1: validate request + issue a pre-signed PUT URL.
 * Throws if the user cannot access the target document.
 */
export async function signUpload(user, params) {
  const { documentType, documentId, fileName, fileType, fileSize } = params;
  assertFileMeta({ fileType, fileSize });
  await assertCanAccessDocument(user, documentType, documentId);
  const ulid = newUlid();
  const safeName = safeStorageFileName(fileName, ulid);
  const key = buildS3Key(documentType, documentId, ulid, safeName);
  const uploadUrl = await getPresignedPutUrl(key, fileType);
  return { uploadUrl, s3Key: key, ulid, safeFileName: safeName };
}

/**
 * Step 2: persist attachment metadata after the client uploaded to S3.
 * Logs an Attachment Uploaded approval_history entry.
 */
export async function completeUpload(user, params) {
  const {
    documentType,
    documentId,
    s3Key,
    fileName,
    originalFileName,
    fileType,
    fileSize,
    approvalStep,
  } = params;
  assertFileMeta({ fileType, fileSize });
  await assertCanAccessDocument(user, documentType, documentId);
  if (!s3Key || typeof s3Key !== 'string') {
    throw badRequest('s3Key is required', 'INVALID_S3_KEY');
  }
  const expectedPrefix = `${documentType}/${documentId}/`;
  if (!s3Key.startsWith(expectedPrefix)) {
    throw badRequest('s3Key does not match document scope', 'INVALID_S3_KEY');
  }

  await connectDB();
  const docId = normalizeDocumentId(documentId);
  const displayName = normalizeDisplayFileName(originalFileName || fileName);

  const doc = await Attachment.create({
    documentType,
    documentId: docId,
    s3Key,
    fileName: displayName,
    originalFileName: displayName,
    fileType,
    fileSize: Number(fileSize),
    s3Url: null,
    uploadedBy: user._id || user.id,
    approvalStep,
    uploadedAt: new Date(),
  });

  await logApprovalHistory({
    documentType,
    documentId,
    stepName: 'Attachment',
    action: 'Attachment Uploaded',
    actionBy: user,
    actionByRole: user.roleName,
    comment: `Uploaded file: ${displayName}`,
  });

  const downloadUrl = await getPresignedGetUrl(doc.s3Key);
  return {
    id: doc._id.toString(),
    documentType: doc.documentType,
    documentId: doc.documentId.toString(),
    fileName: doc.fileName,
    originalFileName: doc.originalFileName || doc.fileName,
    fileType: doc.fileType,
    fileSize: doc.fileSize,
    s3Key: doc.s3Key,
    uploadedAt: doc.uploadedAt,
    downloadUrl,
  };
}

/**
 * List attachments for a document; each row gets a short-lived pre-signed GET URL.
 * Skips the access check when `assertAccess` is false (used by detail views that
 * already performed an access check).
 */
export async function listAttachments(documentType, documentId, user, options = {}) {
  if (options.assertAccess !== false && user) {
    await assertCanAccessDocument(user, documentType, documentId);
  } else {
    await connectDB();
  }
  const docId = normalizeDocumentId(documentId);
  const rows = await Attachment.find({ documentType, documentId: docId })
    .sort({ uploadedAt: -1 })
    .populate('uploadedBy', 'name username email')
    .lean();
  return Promise.all(
    rows.map(async (a) => ({
      id: a._id.toString(),
      fileName: a.fileName,
      originalFileName: a.originalFileName || a.fileName,
      s3Key: a.s3Key,
      fileType: a.fileType,
      fileSize: a.fileSize,
      uploadedAt: a.uploadedAt,
      uploadedBy: a.uploadedBy?.name || a.uploadedBy?.username || a.uploadedBy?.email || null,
      downloadUrl: await getPresignedGetUrl(a.s3Key),
    })),
  );
}
