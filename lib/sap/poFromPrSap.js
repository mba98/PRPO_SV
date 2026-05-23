import '@/models/index.js';
import PurchaseRequest from '@/models/PurchaseRequest.js';
import PurchaseOrder from '@/models/PurchaseOrder.js';
import { connectDB } from '@/lib/mongodb';
import {
  linesForVendor,
  resolvePrBaseLineNum,
} from '@/lib/sap/mappers/poToSap.js';
import { logApprovalHistory } from '@/lib/auditHistory.js';
import { notifyEvent } from '@/lib/emailNotify.js';
import { nextNumber } from '@/lib/numbering.js';
import { getApprovalSteps, getInitialSubmitState } from '@/lib/approvalEngine.js';
import { resolveLineWarehouseCode } from '@/lib/sap/sapWarehouseConfig.js';
import { resolveLineUomCode } from '@/lib/sap/uomCode.js';
import { resolveDefaultPoDocRate } from '@/lib/sap/sapPoConfig.js';

export async function assertPrReadyForPo(pr) {
  if (!pr) return { error: 'NOT_FOUND' };
  if (!pr.sapPRDocEntry) {
    return { error: 'NO_SAP_PR', message: 'PR must exist in SAP before creating a PO' };
  }
  if (!['Created in SAP', 'Partially Ordered'].includes(pr.status)) {
    return { error: 'INVALID_STATUS', message: 'PR is not ready for PO creation' };
  }
  return { ok: true };
}

/**
 * Duplicate portal PO per PR + vendor (excludes rejected).
 */
export async function findDuplicatePo(prId, vendor) {
  return PurchaseOrder.findOne({
    relatedPRId: prId,
    vendor: (vendor || '').trim(),
    status: { $ne: 'Rejected' },
  }).lean();
}

/**
 * Create portal PO from approved PR — enters PM approval (no SAP until final approval).
 */
export async function createPortalPoFromPr(prId, user, { vendor }) {
  await connectDB();
  const pr = await PurchaseRequest.findById(prId);
  if (!pr) return { error: 'NOT_FOUND' };

  const ready = await assertPrReadyForPo(pr.toObject());
  if (!ready.ok) return ready;

  const vendorCode = (vendor || '').trim();
  if (!vendorCode) {
    return { error: 'VENDOR_REQUIRED', message: 'Vendor is required' };
  }

  const duplicate = await findDuplicatePo(prId, vendorCode);
  if (duplicate) {
    return {
      error: 'DUPLICATE_PO',
      message: `A purchase order already exists for this PR and vendor (${duplicate.portalPONumber})`,
      poId: duplicate._id.toString(),
      portalPONumber: duplicate.portalPONumber,
    };
  }

  const eligibleLines = linesForVendor(pr.toObject(), vendorCode);
  if (!eligibleLines.length) {
    return { error: 'NO_LINES', message: 'No remaining lines for this vendor' };
  }

  const steps = await getApprovalSteps('PO');
  const initial = getInitialSubmitState(steps, 'PO');
  const portalPONumber = await nextNumber('PO');
  const prObj = pr.toObject();
  const headerDate =
    prObj.documentDate || prObj.postingDate || prObj.requiredDate || prObj.dueDate || new Date();
  const requiredDate = prObj.requiredDate || prObj.dueDate || headerDate;
  const remarksBase = prObj.remarks?.trim()
    ? `From PR ${prObj.portalPRNumber}: ${prObj.remarks.trim()}`
    : `From PR ${prObj.portalPRNumber}`;
  const defaultDocRate = resolveDefaultPoDocRate();

  const poDoc = await PurchaseOrder.create({
    portalPONumber,
    relatedPRId: pr._id,
    relatedPRNumber: pr.portalPRNumber,
    relatedSAPPRDocEntry: pr.sapPRDocEntry,
    relatedSAPPRDocNum: pr.sapPRDocNum,
    requester: pr.requester,
    department: pr.department,
    project: pr.project,
    vendor: vendorCode,
    warehouse: pr.warehouse,
    postingDate: pr.postingDate || headerDate,
    documentDate: pr.documentDate || headerDate,
    requiredDate,
    dueDate: prObj.dueDate || requiredDate,
    ...(defaultDocRate != null ? { docRate: defaultDocRate } : {}),
    remarks: remarksBase,
    status: initial.status,
    currentApprovalStep: initial.currentApprovalStep,
    createdBy: user._id || user.id,
    lines: eligibleLines.map((line) => {
      const lineId = line._id?.toString();
      const prLineIndex = pr.lines.findIndex((l) => l._id?.toString() === lineId);
      const qty = (line.quantity || 0) - (line.orderedQty || 0);
      const unit = line.estimatedUnitPrice;
      return {
        relatedPRLineId: line._id,
        itemCode: line.itemCode,
        itemName: line.itemName,
        quantity: qty,
        uom: line.uom,
        uomCode: resolveLineUomCode(line) || undefined,
        warehouseCode: resolveLineWarehouseCode(line, prObj),
        projectCode: line.projectCode || pr.project,
        costCenter: line.costCenter,
        unitPrice: unit,
        lineTotal: unit != null && qty != null ? unit * qty : line.estimatedTotal,
        remarks: line.remarks,
        uDepartment: line.uDepartment,
        uDelDate: line.uDelDate,
        uRate: line.uRate,
        sapPRBaseLine: resolvePrBaseLineNum(pr.toObject(), line, prLineIndex >= 0 ? prLineIndex : 0),
      };
    }),
  });

  await logApprovalHistory({
    documentType: 'PO',
    documentId: poDoc._id,
    stepName: 'Creation',
    action: 'Created',
    actionBy: user,
    actionByRole: user.roleName,
    previousStatus: null,
    newStatus: poDoc.status,
    comment: `Created from PR ${pr.portalPRNumber}`,
  });

  await logApprovalHistory({
    documentType: 'PR',
    documentId: pr._id,
    stepName: 'PO Creation',
    action: 'Submitted',
    actionBy: user,
    comment: `Portal PO ${portalPONumber} created for vendor ${vendorCode}`,
    previousStatus: pr.status,
    newStatus: pr.status,
  });

  await notifyEvent('po.created', {
    subject: `PO ${portalPONumber} pending approval`,
    body: `Purchase Order ${portalPONumber} from PR ${pr.portalPRNumber} requires project manager approval.`,
    relatedDocumentType: 'PO',
    relatedDocumentId: poDoc._id.toString(),
  });

  const refreshed = await PurchaseOrder.findById(poDoc._id).lean();
  return {
    success: true,
    po: {
      id: refreshed._id.toString(),
      portalPONumber: refreshed.portalPONumber,
      status: refreshed.status,
      vendor: refreshed.vendor,
    },
  };
}
