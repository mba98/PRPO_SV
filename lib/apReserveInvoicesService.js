import mongoose from 'mongoose';
import '@/models/index.js';
import APReserveInvoice from '@/models/APReserveInvoice.js';
import PurchaseOrder from '@/models/PurchaseOrder.js';
import EmailLog from '@/models/EmailLog.js';
import { connectDB } from '@/lib/mongodb';
import { buildPagination } from '@/lib/errors';
import { nextNumber } from '@/lib/numbering.js';
import { logApprovalHistory, getApprovalHistory } from '@/lib/auditHistory.js';
import { buildApriLinesFromPo } from '@/lib/sap/mappers/apReserveInvoiceToSap.js';
import { createSapApReserveInvoice, retrySapApReserveInvoice } from '@/lib/sap/apriSap.js';
import { filterPosReadyForApri } from '@/lib/poApriReadiness.js';
import { sanitizePo } from '@/lib/purchaseOrdersService.js';
import {
  resolveDefaultPoDocCurrency,
  resolveDefaultPoDocRate,
} from '@/lib/sap/sapPoConfig.js';

const DOC_TYPE = 'APRI';
const LIST_PERMS = ['apinvoice.create', 'view.all'];

export function sanitizeApri(doc) {
  if (!doc) return null;
  const id = doc._id?.toString() || doc.id;
  return {
    id,
    portalAPNumber: doc.portalAPNumber,
    relatedPOId: doc.relatedPOId?._id?.toString() || doc.relatedPOId?.toString(),
    relatedPONumber: doc.relatedPONumber,
    relatedSAPPODocEntry: doc.relatedSAPPODocEntry,
    relatedSAPPODocNum: doc.relatedSAPPODocNum,
    vendor: doc.vendor,
    postingDate: doc.postingDate,
    documentDate: doc.documentDate,
    dueDate: doc.dueDate,
    taxDate: doc.taxDate,
    docCurrency: doc.docCurrency,
    docRate: doc.docRate,
    remarks: doc.remarks,
    status: doc.status,
    sapAPDocEntry: doc.sapAPDocEntry,
    sapAPDocNum: doc.sapAPDocNum,
    sapCreationStatus: doc.sapCreationStatus,
    sapErrorMessage: doc.sapErrorMessage,
    sapResponse: doc.sapResponse,
    lines: doc.lines || [],
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    __v: doc.__v,
  };
}

function userCanViewApri(user) {
  return user.permissions?.some((p) => LIST_PERMS.includes(p));
}

function buildListFilter(user, { searchParams }) {
  const filter = {};
  if (!user.permissions?.includes('view.all')) {
    filter.createdBy = user._id;
  }
  const portalAPNumber = searchParams.get('portalAPNumber');
  if (portalAPNumber) filter.portalAPNumber = { $regex: portalAPNumber, $options: 'i' };
  const relatedPONumber = searchParams.get('relatedPONumber');
  if (relatedPONumber) filter.relatedPONumber = { $regex: relatedPONumber, $options: 'i' };
  const vendor = searchParams.get('vendor');
  if (vendor) filter.vendor = { $regex: vendor, $options: 'i' };
  const status = searchParams.get('status');
  if (status) filter.status = status;
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }
  return filter;
}

export async function listApReserveInvoices(user, { page, limit, sort, order, searchParams }) {
  await connectDB();
  if (!userCanViewApri(user)) {
    const err = new Error('Forbidden');
    err.code = 'FORBIDDEN';
    throw err;
  }
  const filter = buildListFilter(user, { searchParams });
  const sortDir = order === 'asc' ? 1 : -1;
  const sortField = sort || 'createdAt';

  const [total, rows] = await Promise.all([
    APReserveInvoice.countDocuments(filter),
    APReserveInvoice.find(filter).sort({ [sortField]: sortDir }).skip((page - 1) * limit).limit(limit).lean(),
  ]);

  return {
    items: rows.map(sanitizeApri),
    pagination: buildPagination(page, limit, total),
  };
}

export async function findApriByPoId(poId) {
  return APReserveInvoice.findOne({ relatedPOId: poId }).lean();
}

export async function listPosReadyForApri(user, { page, limit }) {
  await connectDB();
  const filter = { status: 'Created in SAP', sapPODocEntry: { $exists: true, $ne: null } };
  if (!user.permissions?.includes('view.all') && !user.permissions?.includes('apinvoice.create')) {
    filter.requester = user._id;
  }

  const rows = await PurchaseOrder.find(filter)
    .populate('requester', 'name email')
    .sort({ createdAt: -1 })
    .lean();

  const poIds = rows.map((r) => r._id);
  const apris = await APReserveInvoice.find({ relatedPOId: { $in: poIds } }).lean();
  const apriByPo = new Map(apris.map((a) => [a.relatedPOId.toString(), a]));

  const ready = filterPosReadyForApri(rows, apriByPo);
  const total = ready.length;
  const start = (page - 1) * limit;

  return {
    items: ready.slice(start, start + limit).map(sanitizePo),
    pagination: buildPagination(page, limit, total),
  };
}

export async function getApReserveInvoiceById(id, user) {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  if (!userCanViewApri(user)) {
    const err = new Error('Forbidden');
    err.code = 'FORBIDDEN';
    throw err;
  }

  const apri = await APReserveInvoice.findById(id).lean();
  if (!apri) return null;

  const [history, emailLogs, relatedPo] = await Promise.all([
    getApprovalHistory(DOC_TYPE, id),
    EmailLog.find({ relatedDocumentType: DOC_TYPE, relatedDocumentId: apri._id })
      .sort({ sentAt: -1 })
      .lean(),
    PurchaseOrder.findById(apri.relatedPOId).select('portalPONumber status sapPODocNum').lean(),
  ]);

  return {
    ...sanitizeApri(apri),
    relatedPO: relatedPo
      ? {
          id: relatedPo._id.toString(),
          portalPONumber: relatedPo.portalPONumber,
          status: relatedPo.status,
          sapPODocNum: relatedPo.sapPODocNum,
        }
      : null,
    approvalHistory: history.map((h) => ({
      id: h._id.toString(),
      stepName: h.stepName,
      action: h.action,
      actionBy: h.actionBy?.name || h.actionBy?.username,
      actionByRole: h.actionByRole,
      comment: h.comment,
      previousStatus: h.previousStatus,
      newStatus: h.newStatus,
      actionDate: h.actionDate,
    })),
    emailLogs: emailLogs.map((e) => ({
      id: e._id.toString(),
      to: e.to,
      subject: e.subject,
      emailStatus: e.emailStatus,
      sentAt: e.sentAt,
      errorMessage: e.errorMessage,
    })),
  };
}

export async function createApriFromPo(poId, user) {
  await connectDB();
  const po = await PurchaseOrder.findById(poId).lean();
  if (!po) return { error: 'NOT_FOUND' };

  if (po.status !== 'Created in SAP') {
    return { error: 'INVALID_STATUS', message: 'Purchase order must be Created in SAP' };
  }
  if (po.sapPODocEntry == null) {
    return { error: 'NO_SAP_PO', message: 'Purchase order has no SAP DocEntry' };
  }

  const existing = await findApriByPoId(poId);
  if (existing) {
    if (existing.sapAPDocEntry || existing.status === 'Created in SAP') {
      return {
        error: 'DUPLICATE_APRI',
        message: 'An A/P Reserve Invoice already exists for this purchase order',
        apriId: existing._id.toString(),
      };
    }
    if (existing.status === 'Creating in SAP') {
      return { error: 'DUPLICATE_APRI', message: 'APRI creation already in progress' };
    }
    if (existing.status === 'Failed to Create in SAP') {
      return {
        error: 'APRI_EXISTS_FAILED',
        message: 'A failed APRI exists — use retry on the APRI record',
        apriId: existing._id.toString(),
      };
    }
  }

  const apriLines = buildApriLinesFromPo(po);
  if (!apriLines.length) {
    return {
      error: 'INVALID_LINES',
      message: 'No PO lines with valid SAP base references (LineNum) found',
    };
  }

  const portalAPNumber = await nextNumber('APRI');
  const documentDate = po.documentDate || po.postingDate || new Date();
  const dueDate = po.requiredDate || po.documentDate || new Date();
  const taxDate = documentDate;
  const docCurrency = po.docCurrency || resolveDefaultPoDocCurrency();
  const rawRate = po.docRate ?? resolveDefaultPoDocRate();
  const docRate = rawRate != null ? Number(rawRate) : undefined;

  const apriDoc = await APReserveInvoice.create({
    portalAPNumber,
    relatedPOId: po._id,
    relatedPONumber: po.portalPONumber,
    relatedSAPPODocEntry: po.sapPODocEntry,
    relatedSAPPODocNum: po.sapPODocNum,
    vendor: po.vendor,
    postingDate: po.postingDate,
    documentDate,
    dueDate,
    taxDate,
    docCurrency,
    ...(Number.isFinite(docRate) && docRate > 0 ? { docRate } : {}),
    remarks: po.remarks,
    status: 'Creating in SAP',
    createdBy: user._id || user.id,
    lines: apriLines,
  });

  await logApprovalHistory({
    documentType: DOC_TYPE,
    documentId: apriDoc._id,
    stepName: 'Creation',
    action: 'Created',
    actionBy: user,
    actionByRole: user.roleName,
    comment: `Created from PO ${po.portalPONumber}`,
    previousStatus: null,
    newStatus: 'Creating in SAP',
  });

  const sapResult = await createSapApReserveInvoice(apriDoc._id.toString(), user);
  const refreshed = await APReserveInvoice.findById(apriDoc._id).lean();

  return {
    apri: sanitizeApri(refreshed),
    sapResult,
  };
}

export async function retryApriSap(id, user) {
  const sapResult = await retrySapApReserveInvoice(id, user);
  const refreshed = await APReserveInvoice.findById(id).lean();
  return { apri: sanitizeApri(refreshed), sapResult };
}
