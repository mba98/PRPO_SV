import mongoose from 'mongoose';
import '@/models/index.js';
import Comment from '@/models/Comment.js';
import Attachment from '@/models/Attachment.js';
import { connectDB } from '@/lib/mongodb';
import { assertCanAccessDocument } from '@/lib/documentAccess.js';
import { logApprovalHistory } from '@/lib/auditHistory.js';

function badRequest(message, code) {
  const err = new Error(message);
  err.code = code;
  err.status = 400;
  return err;
}

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

function sanitizeComment(doc) {
  return {
    id: doc._id.toString(),
    documentType: doc.documentType,
    documentId: doc.documentId?.toString(),
    comment: doc.comment,
    postedBy: sanitizeUser(doc.postedBy),
    postedAt: doc.postedAt,
    attachments: (doc.attachments || [])
      .map(sanitizeAttachment)
      .filter(Boolean),
  };
}

async function loadValidAttachmentIds(documentType, documentId, attachmentIds) {
  if (!attachmentIds?.length) return [];
  const ids = [...new Set(attachmentIds)];
  for (const id of ids) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw badRequest('Invalid attachment id', 'INVALID_ID');
    }
  }
  const rows = await Attachment.find({
    _id: { $in: ids },
    documentType,
    documentId,
  })
    .select('_id')
    .lean();
  if (rows.length !== ids.length) {
    throw badRequest(
      'One or more attachments do not belong to this document',
      'INVALID_ATTACHMENT_SCOPE',
    );
  }
  return rows.map((r) => r._id);
}

/**
 * List comments for a document (oldest → newest), enforcing access.
 */
export async function listComments(user, documentType, documentId) {
  await assertCanAccessDocument(user, documentType, documentId);
  await connectDB();
  const rows = await Comment.find({ documentType, documentId })
    .sort({ postedAt: 1 })
    .populate('postedBy', 'name username email')
    .populate('attachments', 'fileName fileType fileSize')
    .lean();
  return rows.map(sanitizeComment);
}

/**
 * Add a comment + write an "Comment Added" approval history entry.
 */
export async function addComment(user, { documentType, documentId, comment, attachments }) {
  await assertCanAccessDocument(user, documentType, documentId);
  await connectDB();
  const attachmentIds = await loadValidAttachmentIds(
    documentType,
    documentId,
    attachments,
  );
  const created = await Comment.create({
    documentType,
    documentId,
    comment,
    attachments: attachmentIds,
    postedBy: user._id || user.id,
  });

  await logApprovalHistory({
    documentType,
    documentId,
    stepName: 'Comment',
    action: 'Comment Added',
    actionBy: user,
    actionByRole: user.roleName,
    comment,
    attachments: attachmentIds,
  });

  const populated = await Comment.findById(created._id)
    .populate('postedBy', 'name username email')
    .populate('attachments', 'fileName fileType fileSize')
    .lean();
  return sanitizeComment(populated);
}
