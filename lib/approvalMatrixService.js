import mongoose from 'mongoose';
import '@/models/index.js';
import ApprovalMatrix from '@/models/ApprovalMatrix.js';
import Role from '@/models/Role.js';
import { connectDB } from '@/lib/mongodb';
import { buildPagination } from '@/lib/errors';
import { logApprovalMatrixAudit } from '@/lib/approvalMatrixAudit.js';
import { invalidateApprovalStepsCache } from '@/lib/approvalEngine.js';
import { pendingPoStatusForStep } from '@/lib/poStatus.js';

function resolveMatrixPendingStatus(documentType, data) {
  const docType = normalizeDocumentType(documentType);
  if (docType === 'PO') {
    return pendingPoStatusForStep({
      stepName: data.stepName,
      requiredPermission: data.requiredPermission,
      pendingStatus: data.pendingStatus,
    });
  }
  return data.pendingStatus?.trim() || undefined;
}

export function sanitizeApprovalMatrixStep(step) {
  if (!step) return null;
  const approverRole = step.approverRole;
  return {
    id: step._id?.toString?.() ?? step._id,
    documentType: step.documentType,
    stepOrder: step.stepOrder,
    stepName: step.stepName,
    pendingStatus: step.pendingStatus,
    requiredPermission: step.requiredPermission,
    approverRole: approverRole?._id
      ? {
          id: approverRole._id.toString(),
          name: approverRole.name,
        }
      : { id: approverRole?.toString?.() ?? approverRole },
    isActive: step.isActive,
    createdAt: step.createdAt,
    updatedAt: step.updatedAt,
    __v: step.__v,
  };
}

function normalizeDocumentType(value) {
  return String(value || '').trim().toUpperCase();
}

/** Resequence steps to 1..n for a document type (avoids unique index collisions). */
export async function resequenceDocumentType(documentType) {
  const docType = normalizeDocumentType(documentType);
  const steps = await ApprovalMatrix.find({ documentType: docType })
    .sort({ stepOrder: 1, createdAt: 1 });
  for (let i = 0; i < steps.length; i++) {
    steps[i].stepOrder = 1000 + i;
    await steps[i].save();
  }
  for (let i = 0; i < steps.length; i++) {
    steps[i].stepOrder = i + 1;
    await steps[i].save();
  }
}

export async function listApprovalMatrix({ page, limit, sort, order, documentType }) {
  await connectDB();

  const filter = {};
  if (documentType) {
    filter.documentType = normalizeDocumentType(documentType);
  }

  const sortDir = order === 'asc' ? 1 : -1;
  const sortField = sort === 'stepOrder' ? 'stepOrder' : sort || 'documentType';
  const sortObj =
    sortField === 'documentType'
      ? { documentType: sortDir, stepOrder: 1 }
      : { [sortField]: sortDir, documentType: 1 };

  const [total, steps] = await Promise.all([
    ApprovalMatrix.countDocuments(filter),
    ApprovalMatrix.find(filter)
      .populate('approverRole', 'name')
      .sort(sortObj)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  return {
    steps: steps.map(sanitizeApprovalMatrixStep),
    pagination: buildPagination(page, limit, total),
  };
}

export async function listAllStepsForDocumentType(documentType) {
  await connectDB();
  const docType = normalizeDocumentType(documentType);
  const steps = await ApprovalMatrix.find({ documentType: docType })
    .populate('approverRole', 'name')
    .sort({ stepOrder: 1, createdAt: 1 })
    .lean();
  return steps.map(sanitizeApprovalMatrixStep);
}

async function assertApproverRole(roleId) {
  const role = await Role.findById(roleId).lean();
  if (!role) {
    const err = new Error('Approver role not found');
    err.code = 'ROLE_NOT_FOUND';
    throw err;
  }
}

async function nextStepOrder(documentType) {
  const docType = normalizeDocumentType(documentType);
  const max = await ApprovalMatrix.findOne({ documentType: docType })
    .sort({ stepOrder: -1 })
    .select('stepOrder')
    .lean();
  return (max?.stepOrder || 0) + 1;
}

export async function createApprovalMatrixStep(data, user) {
  await connectDB();
  await assertApproverRole(data.approverRole);

  const documentType = normalizeDocumentType(data.documentType);
  const stepOrder = data.stepOrder ?? (await nextStepOrder(documentType));

  try {
    const step = await ApprovalMatrix.create({
      documentType,
      stepOrder,
      stepName: data.stepName.trim(),
      pendingStatus: resolveMatrixPendingStatus(documentType, data),
      requiredPermission: data.requiredPermission,
      approverRole: data.approverRole,
      isActive: data.isActive !== false,
    });
    await resequenceDocumentType(documentType);
    const populated = await ApprovalMatrix.findById(step._id).populate('approverRole', 'name').lean();
    const sanitized = sanitizeApprovalMatrixStep(populated);

    await logApprovalMatrixAudit({
      action: 'CREATE',
      documentType,
      stepId: step._id,
      user,
      newValue: sanitized,
      summary: `Added step "${sanitized.stepName}"`,
    });

    invalidateApprovalStepsCache(documentType);
    return sanitized;
  } catch (err) {
    if (err.code === 11000) {
      const dup = new Error('Step order already exists for this document type');
      dup.code = 'DUPLICATE_STEP';
      throw dup;
    }
    throw err;
  }
}

export async function updateApprovalMatrixStep(id, data, user) {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return { error: 'NOT_FOUND' };
  }

  const existing = await ApprovalMatrix.findById(id).populate('approverRole', 'name');
  if (!existing) {
    return { error: 'NOT_FOUND' };
  }

  if (data.__v !== undefined && existing.__v !== data.__v) {
    return { error: 'CONFLICT' };
  }

  if (data.approverRole) {
    await assertApproverRole(data.approverRole);
  }

  const before = sanitizeApprovalMatrixStep(existing.toObject());
  const prevDocType = existing.documentType;

  if (data.documentType !== undefined) existing.documentType = normalizeDocumentType(data.documentType);
  if (data.stepName !== undefined) existing.stepName = data.stepName.trim();
  if (data.pendingStatus !== undefined || data.requiredPermission !== undefined || data.stepName !== undefined) {
    existing.pendingStatus = resolveMatrixPendingStatus(existing.documentType, {
      stepName: data.stepName ?? existing.stepName,
      requiredPermission: data.requiredPermission ?? existing.requiredPermission,
      pendingStatus: data.pendingStatus ?? existing.pendingStatus,
    });
  }
  if (data.requiredPermission !== undefined) existing.requiredPermission = data.requiredPermission;
  if (data.approverRole !== undefined) existing.approverRole = data.approverRole;
  if (data.isActive !== undefined) existing.isActive = data.isActive;

  try {
    await existing.save();
    await resequenceDocumentType(existing.documentType);
    if (prevDocType !== existing.documentType) {
      await resequenceDocumentType(prevDocType);
    }
    const populated = await ApprovalMatrix.findById(id).populate('approverRole', 'name').lean();
    const after = sanitizeApprovalMatrixStep(populated);

    await logApprovalMatrixAudit({
      action: 'UPDATE',
      documentType: after.documentType,
      stepId: existing._id,
      user,
      oldValue: before,
      newValue: after,
      summary: `Updated step "${after.stepName}"`,
    });

    invalidateApprovalStepsCache(after.documentType);
    if (prevDocType !== after.documentType) {
      invalidateApprovalStepsCache(prevDocType);
    }
    return { step: after };
  } catch (err) {
    if (err.code === 11000) {
      const dup = new Error('Step order already exists for this document type');
      dup.code = 'DUPLICATE_STEP';
      throw dup;
    }
    throw err;
  }
}

export async function deleteApprovalMatrixStep(id, user) {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return { error: 'NOT_FOUND' };

  const existing = await ApprovalMatrix.findById(id).populate('approverRole', 'name').lean();
  if (!existing) return { error: 'NOT_FOUND' };

  const before = sanitizeApprovalMatrixStep(existing);
  await ApprovalMatrix.findByIdAndDelete(id);
  await resequenceDocumentType(before.documentType);

  await logApprovalMatrixAudit({
    action: 'DELETE',
    documentType: before.documentType,
    stepId: id,
    user,
    oldValue: before,
    summary: `Deleted step "${before.stepName}"`,
  });

  invalidateApprovalStepsCache(before.documentType);
  return { deleted: true, id };
}

export async function reorderApprovalMatrixStep(id, direction, user) {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return { error: 'NOT_FOUND' };
  if (direction !== 'up' && direction !== 'down') {
    const err = new Error('Direction must be up or down');
    err.code = 'VALIDATION';
    throw err;
  }

  const step = await ApprovalMatrix.findById(id);
  if (!step) return { error: 'NOT_FOUND' };

  const steps = await ApprovalMatrix.find({ documentType: step.documentType }).sort({
    stepOrder: 1,
    createdAt: 1,
  });
  const idx = steps.findIndex((s) => s._id.equals(step._id));
  const target = direction === 'up' ? idx - 1 : idx + 1;
  if (target < 0 || target >= steps.length) {
    return { error: 'BOUNDARY', message: 'Cannot move step further in that direction' };
  }

  const reordered = [...steps];
  [reordered[idx], reordered[target]] = [reordered[target], reordered[idx]];

  for (let i = 0; i < reordered.length; i++) {
    reordered[i].stepOrder = 1000 + i;
    await reordered[i].save();
  }
  for (let i = 0; i < reordered.length; i++) {
    reordered[i].stepOrder = i + 1;
    await reordered[i].save();
  }

  await logApprovalMatrixAudit({
    action: 'REORDER',
    documentType: step.documentType,
    stepId: id,
    user,
    summary: `Moved step "${step.stepName}" ${direction}`,
  });

  invalidateApprovalStepsCache(step.documentType);
  const refreshed = await listAllStepsForDocumentType(step.documentType);
  return { steps: refreshed };
}
