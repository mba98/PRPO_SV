import mongoose from 'mongoose';
import '@/models/index.js';
import ApprovalMatrix from '@/models/ApprovalMatrix.js';
import Role from '@/models/Role.js';
import { connectDB } from '@/lib/mongodb';
import { buildPagination } from '@/lib/errors';

export function sanitizeApprovalMatrixStep(step) {
  if (!step) return null;
  const approverRole = step.approverRole;
  return {
    id: step._id?.toString?.() ?? step._id,
    documentType: step.documentType,
    stepOrder: step.stepOrder,
    stepName: step.stepName,
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

export async function listApprovalMatrix({ page, limit, sort, order, documentType }) {
  await connectDB();

  const filter = {};
  if (documentType === 'PR' || documentType === 'PO') {
    filter.documentType = documentType;
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

async function assertApproverRole(roleId) {
  const role = await Role.findById(roleId).lean();
  if (!role) {
    const err = new Error('Approver role not found');
    err.code = 'ROLE_NOT_FOUND';
    throw err;
  }
}

export async function createApprovalMatrixStep(data) {
  await connectDB();
  await assertApproverRole(data.approverRole);

  try {
    const step = await ApprovalMatrix.create({
      documentType: data.documentType,
      stepOrder: data.stepOrder,
      stepName: data.stepName.trim(),
      requiredPermission: data.requiredPermission,
      approverRole: data.approverRole,
      isActive: data.isActive !== false,
    });
    const populated = await ApprovalMatrix.findById(step._id).populate('approverRole', 'name').lean();
    return sanitizeApprovalMatrixStep(populated);
  } catch (err) {
    if (err.code === 11000) {
      const dup = new Error('Step order already exists for this document type');
      dup.code = 'DUPLICATE_STEP';
      throw dup;
    }
    throw err;
  }
}

export async function updateApprovalMatrixStep(id, data) {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return { error: 'NOT_FOUND' };
  }

  const existing = await ApprovalMatrix.findById(id);
  if (!existing) {
    return { error: 'NOT_FOUND' };
  }

  if (data.__v !== undefined && existing.__v !== data.__v) {
    return { error: 'CONFLICT' };
  }

  if (data.approverRole) {
    await assertApproverRole(data.approverRole);
  }

  const updates = {};
  if (data.documentType !== undefined) updates.documentType = data.documentType;
  if (data.stepOrder !== undefined) updates.stepOrder = data.stepOrder;
  if (data.stepName !== undefined) updates.stepName = data.stepName.trim();
  if (data.requiredPermission !== undefined) updates.requiredPermission = data.requiredPermission;
  if (data.approverRole !== undefined) updates.approverRole = data.approverRole;
  if (data.isActive !== undefined) updates.isActive = data.isActive;

  try {
    const filter = { _id: id };
    if (data.__v !== undefined) filter.__v = data.__v;

    const updated = await ApprovalMatrix.findOneAndUpdate(filter, { $set: updates }, {
      new: true,
    }).populate('approverRole', 'name');

    if (!updated) {
      return { error: data.__v !== undefined ? 'CONFLICT' : 'NOT_FOUND' };
    }
    return { step: sanitizeApprovalMatrixStep(updated.toObject()) };
  } catch (err) {
    if (err.code === 11000) {
      const dup = new Error('Step order already exists for this document type');
      dup.code = 'DUPLICATE_STEP';
      throw dup;
    }
    throw err;
  }
}
