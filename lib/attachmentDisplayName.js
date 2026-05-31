/**
 * Resolve a human-readable attachment filename for UI (never blank).
 */

function fileExtensionFromName(name) {
  if (!name) return '';
  const dot = String(name).lastIndexOf('.');
  if (dot <= 0) return '';
  return String(name).slice(dot);
}

function extensionFromMime(fileType) {
  if (!fileType) return '';
  const map = {
    'application/pdf': '.pdf',
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'text/csv': '.csv',
  };
  return map[fileType] || '';
}

export function extractNameFromS3Key(s3Key) {
  if (!s3Key) return '';
  const segment = String(s3Key).split('/').pop() || '';
  const dash = segment.indexOf('-');
  if (dash > 0 && dash < segment.length - 1) {
    return segment.slice(dash + 1);
  }
  return segment;
}

export function isBlankDisplayFileName(name) {
  const t = String(name || '').trim();
  if (!t) return true;
  if (t === 'file') return true;
  if (/^\.[a-z0-9]+$/i.test(t)) return true;
  if (!/[\p{L}\p{N}]/u.test(t)) return true;
  return false;
}

/**
 * @param {object} attachment
 * @param {{ fallbackLabel?: string }} [options]
 */
export function resolveAttachmentDisplayName(attachment, options = {}) {
  const fallbackLabel = options.fallbackLabel || 'Attachment';
  const candidates = [
    attachment?.originalFileName,
    attachment?.fileName,
    attachment?.name,
    extractNameFromS3Key(attachment?.s3Key),
  ];

  for (const c of candidates) {
    if (!isBlankDisplayFileName(c)) {
      return String(c).trim();
    }
  }

  const ext =
    fileExtensionFromName(attachment?.fileName) ||
    fileExtensionFromName(extractNameFromS3Key(attachment?.s3Key)) ||
    extensionFromMime(attachment?.fileType);
  return `${fallbackLabel}${ext}`;
}
