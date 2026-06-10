import '@/models/index.js';
import ApprovalMatrixAudit from '@/models/ApprovalMatrixAudit.js';
import { connectDB } from '@/lib/mongodb';

export async function logApprovalMatrixAudit({
  action,
  documentType,
  stepId,
  user,
  oldValue,
  newValue,
  summary,
}) {
  await connectDB();
  await ApprovalMatrixAudit.create({
    action,
    documentType,
    stepId,
    performedBy: user?._id || user?.id,
    performedByName: user?.name || user?.username,
    oldValue,
    newValue,
    summary,
  });
}

export async function listApprovalMatrixAudit({ documentType, limit = 50 } = {}) {
  await connectDB();
  const filter = {};
  if (documentType) filter.documentType = documentType.toUpperCase();
  const rows = await ApprovalMatrixAudit.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return rows.map((row) => ({
    id: row._id.toString(),
    action: row.action,
    documentType: row.documentType,
    stepId: row.stepId?.toString(),
    performedByName: row.performedByName,
    oldValue: row.oldValue,
    newValue: row.newValue,
    summary: row.summary,
    createdAt: row.createdAt,
  }));
}
