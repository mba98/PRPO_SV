import '@/models/index.js';
import ApprovalHistory from '@/models/ApprovalHistory.js';
import { connectDB } from '@/lib/mongodb';

export async function logApprovalHistory({
  documentType,
  documentId,
  stepName,
  stepOrder,
  completionPolicy,
  requiredPermission,
  action,
  actionBy,
  actionByRole,
  comment,
  previousStatus,
  newStatus,
  attachments = [],
}) {
  await connectDB();
  return ApprovalHistory.create({
    documentType,
    documentId,
    stepName,
    stepOrder,
    completionPolicy,
    requiredPermission,
    action,
    actionBy: actionBy?._id || actionBy?.id || actionBy,
    actionByRole: actionByRole || actionBy?.roleName,
    comment,
    attachments,
    previousStatus,
    newStatus,
    actionDate: new Date(),
  });
}

export async function getApprovalHistory(documentType, documentId) {
  await connectDB();
  return ApprovalHistory.find({ documentType, documentId })
    .sort({ actionDate: 1 })
    .populate('actionBy', 'name username')
    .lean();
}
