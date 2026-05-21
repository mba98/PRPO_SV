import '@/models/index.js';
import PurchaseRequest from '@/models/PurchaseRequest.js';
import PurchaseOrder from '@/models/PurchaseOrder.js';
import SapIntegrationLog from '@/models/SapIntegrationLog.js';
import SystemSettings from '@/models/SystemSettings.js';
import { connectDB } from '@/lib/mongodb';
import { createPO } from '@/lib/sapServiceLayer.js';
import {
  mapPoFromPrToSap,
  linesForVendor,
  resolvePrBaseLineNum,
} from '@/lib/sap/mappers/poToSap.js';
import { logApprovalHistory } from '@/lib/auditHistory.js';
import { notifyEvent } from '@/lib/emailNotify.js';
import { nextNumber } from '@/lib/numbering.js';

function parseSapErrorMessage(err) {
  return err?.responseBody?.error?.message?.value || err.message || 'SAP request failed';
}

async function getBranchMap() {
  const doc = await SystemSettings.findOne({ key: 'branch_map' }).lean();
  return doc?.value || {};
}

function computePrOrderStatus(lines) {
  let allDone = true;
  let anyOrdered = false;
  for (const line of lines || []) {
    const ordered = line.orderedQty || 0;
    const qty = line.quantity || 0;
    if (ordered > 0) anyOrdered = true;
    if (ordered < qty) allDone = false;
  }
  if (allDone && anyOrdered) return 'Fully Ordered';
  if (anyOrdered) return 'Partially Ordered';
  return 'Created in SAP';
}

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

export async function findDuplicatePo(prId, vendor) {
  return PurchaseOrder.findOne({
    relatedPRId: prId,
    vendor,
    sapPODocEntry: { $exists: true, $ne: null },
  }).lean();
}

/**
 * Create portal PO + SAP PO from an approved PR for the given vendor.
 */
export async function createSapPoFromPr(prId, user, { vendor }) {
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
      message: `A SAP PO already exists for this PR and vendor (${duplicate.portalPONumber})`,
      sapPODocEntry: duplicate.sapPODocEntry,
      sapPODocNum: duplicate.sapPODocNum,
    };
  }

  const eligibleLines = linesForVendor(pr.toObject(), vendorCode);
  if (!eligibleLines.length) {
    return { error: 'NO_LINES', message: 'No remaining lines for this vendor' };
  }

  const portalPONumber = await nextNumber('PO');
  const branchMap = await getBranchMap();
  const payload = mapPoFromPrToSap(pr.toObject(), { vendor: vendorCode, lines: eligibleLines, branchMap });

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
    postingDate: pr.postingDate,
    documentDate: pr.documentDate,
    requiredDate: pr.requiredDate,
    remarks: pr.remarks,
    status: 'Creating in SAP',
    currentApprovalStep: 0,
    createdBy: user._id || user.id,
    lines: eligibleLines.map((line) => {
      const lineId = line._id?.toString();
      const prLineIndex = pr.lines.findIndex((l) => l._id?.toString() === lineId);
      return {
        relatedPRLineId: line._id,
        itemCode: line.itemCode,
        itemName: line.itemName,
        quantity: (line.quantity || 0) - (line.orderedQty || 0),
        uom: line.uom,
        warehouseCode: line.warehouseCode || pr.warehouse,
        projectCode: line.projectCode || pr.project,
        costCenter: line.costCenter,
        unitPrice: line.estimatedUnitPrice,
        lineTotal: line.estimatedTotal,
        remarks: line.remarks,
        uDepartment: line.uDepartment,
        uDelDate: line.uDelDate,
        uRate: line.uRate,
        sapPRBaseLine: resolvePrBaseLineNum(
          pr.toObject(),
          line,
          prLineIndex >= 0 ? prLineIndex : 0,
        ),
      };
    }),
  });

  const previousPrStatus = pr.status;
  await PurchaseRequest.updateOne(
    { _id: prId },
    { $set: { sapPOCreationStatus: 'Creating', sapPOErrorMessage: null } },
  );

  try {
    const sapResult = await createPO(payload);
    const docEntry = sapResult?.DocEntry;
    const docNum = sapResult?.DocNum != null ? String(sapResult.DocNum) : undefined;

    await PurchaseOrder.updateOne(
      { _id: poDoc._id },
      {
        $set: {
          status: 'Created in SAP',
          sapPODocEntry: docEntry,
          sapPODocNum: docNum,
          sapCreationStatus: 'Success',
          sapResponse: sapResult,
          sapErrorMessage: null,
        },
      },
    );

    for (const line of pr.lines) {
      const lineId = line._id?.toString();
      if (eligibleLines.some((el) => el._id?.toString() === lineId)) {
        line.orderedQty = line.quantity || 0;
      }
    }
    const newStatus = computePrOrderStatus(pr.lines);

    await PurchaseRequest.updateOne(
      { _id: prId },
      {
        $set: {
          status: newStatus,
          lines: pr.lines,
          sapPODocEntry: docEntry,
          sapPODocNum: docNum,
          sapPOCreationStatus: 'Success',
          sapPOErrorMessage: null,
          sapPOResponse: sapResult,
          relatedPortalPONumber: portalPONumber,
        },
      },
    );

    await SapIntegrationLog.create({
      documentType: 'PO',
      documentId: poDoc._id,
      action: 'CREATE_PO_FROM_PR',
      requestPayload: payload,
      responsePayload: sapResult,
      sapDocEntry: docEntry,
      sapDocNum: docNum,
      status: 'Success',
    });

    await logApprovalHistory({
      documentType: 'PR',
      documentId: prId,
      stepName: 'PO Creation',
      action: 'SAP Created',
      actionBy: user,
      comment: `PO ${portalPONumber} created in SAP (DocNum: ${docNum}) for vendor ${vendorCode}`,
      previousStatus: previousPrStatus,
      newStatus,
    });

    await logApprovalHistory({
      documentType: 'PO',
      documentId: poDoc._id,
      stepName: 'SAP Integration',
      action: 'SAP Created',
      actionBy: user,
      previousStatus: 'Creating in SAP',
      newStatus: 'Created in SAP',
    });

    await notifyEvent('po.sap.created', {
      subject: `PO ${portalPONumber} created from PR ${pr.portalPRNumber}`,
      body: `Purchase Order ${portalPONumber} was created in SAP (DocNum: ${docNum}) from PR ${pr.portalPRNumber}.`,
      relatedDocumentType: 'PO',
      relatedDocumentId: poDoc._id.toString(),
    });

    const refreshedPr = await PurchaseRequest.findById(prId).lean();
    const refreshedPo = await PurchaseOrder.findById(poDoc._id).lean();

    return {
      success: true,
      po: {
        id: refreshedPo._id.toString(),
        portalPONumber: refreshedPo.portalPONumber,
        sapPODocEntry: refreshedPo.sapPODocEntry,
        sapPODocNum: refreshedPo.sapPODocNum,
      },
      pr: {
        id: refreshedPr._id.toString(),
        status: refreshedPr.status,
        sapPODocEntry: refreshedPr.sapPODocEntry,
        sapPODocNum: refreshedPr.sapPODocNum,
      },
    };
  } catch (err) {
    const sapMessage = parseSapErrorMessage(err);

    await PurchaseOrder.updateOne(
      { _id: poDoc._id },
      {
        $set: {
          status: 'Failed to Create in SAP',
          sapCreationStatus: 'Failed',
          sapErrorMessage: sapMessage,
        },
      },
    );

    await PurchaseRequest.updateOne(
      { _id: prId },
      {
        $set: {
          sapPOCreationStatus: 'Failed',
          sapPOErrorMessage: sapMessage,
        },
      },
    );

    await SapIntegrationLog.create({
      documentType: 'PO',
      documentId: poDoc._id,
      action: 'CREATE_PO_FROM_PR',
      requestPayload: payload,
      responsePayload: err.responseBody || null,
      status: 'Failed',
      errorMessage: sapMessage,
    });

    await logApprovalHistory({
      documentType: 'PR',
      documentId: prId,
      stepName: 'PO Creation',
      action: 'SAP Failed',
      actionBy: user,
      comment: sapMessage,
      previousStatus: previousPrStatus,
      newStatus: pr.status,
    });

    await notifyEvent('po.sap.failed', {
      subject: `PO creation failed for PR ${pr.portalPRNumber}`,
      body: `Failed to create SAP purchase order from PR ${pr.portalPRNumber} (vendor ${vendorCode}).`,
      relatedDocumentType: 'PR',
      relatedDocumentId: prId,
    });

    return { error: 'SAP_FAILED', message: sapMessage, poId: poDoc._id.toString() };
  }
}

/**
 * Retry SAP PO for a failed portal PO tied to a PR.
 */
export async function retrySapPoFromPr(prId, user, { vendor }) {
  await connectDB();
  const failedPo = await PurchaseOrder.findOne({
    relatedPRId: prId,
    vendor: (vendor || '').trim(),
    status: 'Failed to Create in SAP',
    sapPODocEntry: null,
  }).sort({ createdAt: -1 });

  if (failedPo) {
    await PurchaseOrder.deleteOne({ _id: failedPo._id });
  }

  return createSapPoFromPr(prId, user, { vendor });
}
