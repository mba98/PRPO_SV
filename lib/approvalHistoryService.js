import '@/models/index.js';
import ApprovalHistory from '@/models/ApprovalHistory.js';
import { connectDB } from '@/lib/mongodb';
import { assertCanAccessDocument } from '@/lib/documentAccess.js';
import { normalizeDocumentId } from '@/lib/attachmentsService.js';

function sanitizeUser(user) {
  if (!user) return null;
  return user.name || user.username || user.email || null;
}

function sanitizeAttachment(att) {
  if (!att) return null;
  return {
    id: att._id?.toString() || att.toString(),
    fileName: att.fileName,
    fileType: att.fileType,
    fileSize: att.fileSize,
  };
}

function sanitizeEntry(entry) {
  return {
    id: entry._id.toString(),
    documentType: entry.documentType,
    documentId: entry.documentId?.toString(),
    stepName: entry.stepName,
    action: entry.action,
    actionBy: sanitizeUser(entry.actionBy),
    actionByRole: entry.actionByRole,
    comment: entry.comment,
    previousStatus: entry.previousStatus,
    newStatus: entry.newStatus,
    actionDate: entry.actionDate,
    attachments: (entry.attachments || [])
      .map(sanitizeAttachment)
      .filter(Boolean),
  };
}

/**
 * Chronological approval history for a document (oldest → newest).
 * Enforces per-document access using documentAccess.js.
 */
export async function listApprovalHistory(user, documentType, documentId) {
  await assertCanAccessDocument(user, documentType, documentId);
  await connectDB();
  const docId = normalizeDocumentId(documentId);
  const rows = await ApprovalHistory.find({ documentType, documentId: docId })
    .sort({ actionDate: 1 })
    .populate('actionBy', 'name username email')
    .populate('attachments', 'fileName fileType fileSize')
    .lean();
  return rows.map(sanitizeEntry);
}
