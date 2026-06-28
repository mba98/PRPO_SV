import '@/models/index.js';
import PurchaseRequest from '@/models/PurchaseRequest.js';
import PurchaseOrder from '@/models/PurchaseOrder.js';
import { connectDB } from '@/lib/mongodb';
import {
  linesForVendor,
  resolvePrBaseLineNum,
} from '@/lib/sap/mappers/poToSap.js';
import { logApprovalHistory } from '@/lib/auditHistory.js';
import { notifyWorkflowEmailSafe } from '@/lib/emailNotify.js';
import { buildPoEmailContext } from '@/lib/emailContext.js';
import { nextNumber } from '@/lib/numbering.js';
import { getApprovalSteps, getInitialSubmitState } from '@/lib/approvalEngine.js';
import { resolveLineWarehouseCode } from '@/lib/sap/sapWarehouseConfig.js';
import { resolveLineUomCode } from '@/lib/sap/uomCode.js';
import {
  normalizePoDocRateForStorage,
} from '@/lib/poCurrency.js';
import { getVendorCurrencyConfig, validatePoDocCurrencyForVendor } from '@/lib/sap/vendorCurrencies.js';
import { PO_STATUS, poStatusInQuery, poStatusLabel } from '@/lib/poStatus.js';
import { parsePoFormDate } from '@/lib/poFormUtils.js';

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
    status: { $nin: poStatusInQuery(PO_STATUS.REJECTED).$in },
  }).lean();
}

function findEligiblePrLine(eligibleLines, submitted) {
  if (submitted.relatedPRLineId) {
    const byId = eligibleLines.find(
      (line) => line._id?.toString?.() === String(submitted.relatedPRLineId),
    );
    if (byId) return byId;
  }
  return eligibleLines.find((line) => line.itemCode === submitted.itemCode);
}

function normalizeSubmittedPoLines(prObj, vendorCode, submittedLines = []) {
  const eligibleLines = linesForVendor(prObj, vendorCode);
  if (!eligibleLines.length) {
    return { error: 'NO_LINES', message: 'No remaining lines for this vendor' };
  }
  if (!submittedLines.length) {
    return { error: 'NO_LINES', message: 'At least one line is required' };
  }

  const usedPrLineIds = new Set();
  const normalized = [];

  for (const submitted of submittedLines) {
    const prLine = findEligiblePrLine(eligibleLines, submitted);
    if (!prLine) {
      return {
        error: 'INVALID_LINE',
        message: `Line item ${submitted.itemCode || ''} is not eligible for this PR and vendor`,
      };
    }

    const prLineId = prLine._id?.toString?.();
    if (prLineId && usedPrLineIds.has(prLineId)) {
      return {
        error: 'INVALID_LINE',
        message: `Duplicate line submission for item ${prLine.itemCode}`,
      };
    }
    if (prLineId) usedPrLineIds.add(prLineId);

    const remaining = (prLine.quantity || 0) - (prLine.orderedQty || 0);
    const qty = Number(submitted.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return {
        error: 'INVALID_QUANTITY',
        message: `Quantity must be greater than zero for item ${prLine.itemCode}`,
      };
    }
    if (qty > remaining) {
      return {
        error: 'INVALID_QUANTITY',
        message: `Quantity for item ${prLine.itemCode} exceeds remaining PR quantity (${remaining})`,
      };
    }

    const unitPrice = Number(submitted.unitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return {
        error: 'INVALID_PRICE',
        message: `Unit price is invalid for item ${prLine.itemCode}`,
      };
    }

    const warehouseCode =
      submitted.warehouseCode?.trim() ||
      resolveLineWarehouseCode(prLine, prObj) ||
      prLine.warehouseCode ||
      prObj.warehouse;
    if (!warehouseCode) {
      return {
        error: 'INVALID_WAREHOUSE',
        message: `Warehouse is required for item ${prLine.itemCode}`,
      };
    }

    const prLineIndex = prObj.lines.findIndex(
      (l) => l._id?.toString?.() === prLineId,
    );
    const lineTotal = qty * unitPrice;

    normalized.push({
      relatedPRLineId: prLine._id,
      itemCode: prLine.itemCode,
      itemName: submitted.itemName?.trim() || prLine.itemName,
      quantity: qty,
      uom: prLine.uom,
      uomCode: submitted.uomCode?.trim() || resolveLineUomCode(prLine) || undefined,
      warehouseCode,
      projectCode: prLine.projectCode || prObj.project,
      costCenter: prLine.costCenter,
      unitPrice,
      lineTotal,
      remarks: submitted.remarks?.trim() || prLine.remarks,
      uDepartment: prLine.uDepartment,
      uDelDate: prLine.uDelDate,
      uRate: prLine.uRate,
      sapPRBaseLine: resolvePrBaseLineNum(
        prObj,
        prLine,
        prLineIndex >= 0 ? prLineIndex : 0,
      ),
    });
  }

  return { lines: normalized };
}

/**
 * Create portal PO from approved PR — enters PM approval (no SAP until final approval).
 */
export async function createPortalPoFromPr(prId, user, body = {}) {
  await connectDB();
  const pr = await PurchaseRequest.findById(prId);
  if (!pr) return { error: 'NOT_FOUND' };

  const ready = await assertPrReadyForPo(pr.toObject());
  if (!ready.ok) return ready;

  const vendorCode = (body.vendor || '').trim();
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

  const prObj = pr.toObject();
  const lineResult = normalizeSubmittedPoLines(prObj, vendorCode, body.lines);
  if (lineResult.error) return lineResult;

  const steps = await getApprovalSteps('PO');
  const initial = getInitialSubmitState(steps, 'PO');
  const portalPONumber = await nextNumber('PO');
  const headerDate =
    prObj.documentDate || prObj.postingDate || prObj.requiredDate || prObj.dueDate || new Date();
  const requiredDate =
    parsePoFormDate(body.requiredDate) || prObj.requiredDate || prObj.dueDate || headerDate;
  const remarksBase = prObj.remarks?.trim()
    ? `From PR ${prObj.portalPRNumber}: ${prObj.remarks.trim()}`
    : `From PR ${prObj.portalPRNumber}`;
  let docCurrency;
  try {
    const config = await getVendorCurrencyConfig(vendorCode);
    const toValidate = body.docCurrency ?? config.defaultCurrency;
    const result = validatePoDocCurrencyForVendor(toValidate, config);
    if (!result.ok) {
      return {
        error: result.code || 'INVALID_CURRENCY',
        message: result.message || 'Selected currency is not allowed for this Vendor',
      };
    }
    docCurrency = result.currency;
  } catch (err) {
    return {
      error: err.code || 'VENDOR_CURRENCY_CONFIG',
      message: err.message || 'Vendor currency configuration could not be loaded from SAP',
    };
  }
  const docRate = normalizePoDocRateForStorage(docCurrency, body.docRate);

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
    postingDate: parsePoFormDate(body.postingDate) || pr.postingDate || headerDate,
    documentDate: parsePoFormDate(body.documentDate) || pr.documentDate || headerDate,
    requiredDate,
    dueDate: parsePoFormDate(body.dueDate) || prObj.dueDate || requiredDate,
    docCurrency,
    ...(docRate != null ? { docRate } : {}),
    remarks: body.remarks?.trim() || remarksBase,
    status: initial.status,
    currentApprovalStep: initial.currentApprovalStep,
    createdBy: user._id || user.id,
    lines: lineResult.lines,
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

  if (!pr.relatedPortalPONumber) {
    pr.relatedPortalPONumber = portalPONumber;
  }
  if (pr.status === 'Created in SAP') {
    pr.status = 'Partially Ordered';
  }
  await pr.save();

  notifyWorkflowEmailSafe(
    'po.created',
    {
      ...buildPoEmailContext(
        typeof poDoc.toObject === 'function' ? poDoc.toObject() : poDoc,
        { relatedPRNumber: pr.portalPRNumber },
      ),
      status: poStatusLabel(initial.status),
    },
    { documentType: 'PO', documentId: poDoc._id.toString() },
  );

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
