/**
 * Client-safe constants for the attachments module.
 * Kept separate from `attachmentsService.js` (server-only S3 imports).
 */
export const ALLOWED_MIME_TYPES_CLIENT = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
];

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
