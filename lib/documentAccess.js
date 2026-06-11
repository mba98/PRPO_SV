import mongoose from 'mongoose';
import '@/models/index.js';
import PurchaseRequest from '@/models/PurchaseRequest.js';
import PurchaseOrder from '@/models/PurchaseOrder.js';
import APReserveInvoice from '@/models/APReserveInvoice.js';
import { connectDB } from '@/lib/mongodb';
import { getEffectivePermissions } from '@/lib/effectivePermissions.js';
import { isPendingPoApprovalStatus } from '@/lib/poStatus.js';
import { PO_APPROVAL_PERMISSIONS } from '@/lib/permissions.js';
import { userHasAnyPoApprovalPermission } from '@/lib/poPermissions.js';
import { userCanViewApriDocument } from '@/lib/apriPermissions.js';

const SUPPORTED_TYPES = ['PR', 'PO', 'APRI'];

function notFound(message) {
  const err = new Error(message || 'Document not found');
  err.code = 'NOT_FOUND';
  err.status = 404;
  return err;
}

function forbidden(message) {
  const err = new Error(message || 'Forbidden');
  err.code = 'FORBIDDEN';
  err.status = 403;
  return err;
}

function badRequest(message, code = 'INVALID_ID') {
  const err = new Error(message || 'Invalid document reference');
  err.code = code;
  err.status = 400;
  return err;
}

function modelFor(documentType) {
  if (documentType === 'PR') return PurchaseRequest;
  if (documentType === 'PO') return PurchaseOrder;
  if (documentType === 'APRI') return APReserveInvoice;
  return null;
}

function sameId(a, b) {
  if (!a || !b) return false;
  return a.toString() === b.toString();
}

function canAccessPr(user, pr, permissions) {
  if (permissions.includes('view.all')) return true;
  const requesterId = pr.requester?._id || pr.requester;
  if (sameId(requesterId, user._id)) return true;
  return (
    permissions.includes('pr.approve.whs') || permissions.includes('pr.approve.pm')
  );
}

function canAccessPo(user, po, permissions) {
  if (permissions.includes('view.all')) return true;
  const requesterId = po.requester?._id || po.requester;
  if (sameId(requesterId, user._id)) return true;
  if (isPendingPoApprovalStatus(po.status)) {
    return userHasAnyPoApprovalPermission(permissions) || permissions.includes('po.create');
  }
  return (
    permissions.includes('po.create') ||
    PO_APPROVAL_PERMISSIONS.some((p) => permissions.includes(p))
  );
}

async function canAccess(documentType, user, document) {
  const permissions = getEffectivePermissions(user);
  if (documentType === 'PR') return canAccessPr(user, document, permissions);
  if (documentType === 'PO') return canAccessPo(user, document, permissions);
  if (documentType === 'APRI') return userCanViewApriDocument(user, document);
  return false;
}

/**
 * Fetch the target document and assert the user can access it.
 * Throws errors with stable codes (INVALID_TYPE / INVALID_ID / NOT_FOUND / FORBIDDEN).
 */
export async function assertCanAccessDocument(user, documentType, documentId) {
  if (!SUPPORTED_TYPES.includes(documentType)) {
    throw badRequest('Unsupported document type', 'INVALID_TYPE');
  }
  if (!documentId || !mongoose.Types.ObjectId.isValid(documentId)) {
    throw badRequest('Invalid document id');
  }
  await connectDB();
  const Model = modelFor(documentType);
  const document = await Model.findById(documentId).lean();
  if (!document) {
    throw notFound(`${documentType} not found`);
  }
  if (!(await canAccess(documentType, user, document))) {
    throw forbidden();
  }
  return document;
}

export { SUPPORTED_TYPES };
