/**
 * Approval engine — reads approval_matrix and advances steps.
 * Full implementation in Phase 2+.
 */

import ApprovalMatrix from '@/models/ApprovalMatrix';
import { connectDB } from '@/lib/mongodb';

/**
 * Load active approval steps for a document type, ordered by stepOrder.
 */
export async function getApprovalSteps(documentType) {
  await connectDB();
  return ApprovalMatrix.find({ documentType, isActive: true })
    .sort({ stepOrder: 1 })
    .populate('approverRole')
    .lean();
}
