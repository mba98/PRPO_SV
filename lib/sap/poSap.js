import '@/models/index.js';
import PurchaseRequest from '@/models/PurchaseRequest.js';
import PurchaseOrder from '@/models/PurchaseOrder.js';
import SapIntegrationLog from '@/models/SapIntegrationLog.js';
import SystemSettings from '@/models/SystemSettings.js';
import { connectDB } from '@/lib/mongodb';
import { createPO } from '@/lib/sapServiceLayer.js';
import { mapPoToSapFromPortalRecord } from '@/lib/sap/mappers/poToSap.js';
import { logApprovalHistory } from '@/lib/auditHistory.js';
import { notifyEvent } from '@/lib/emailNotify.js';

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

/**
 * Create SAP PO from an approved portal PurchaseOrder (after final approval).
 */
export async function createSapPurchaseOrder(poId, user) {
  await connectDB();
  const po = await PurchaseOrder.findById(poId);
  if (!po) return { error: 'NOT_FOUND' };

  if (po.sapPODocEntry) {
    return {
      error: 'DUPLICATE_SAP',
      message: 'SAP PO already exists',
      sapPODocEntry: po.sapPODocEntry,
      sapPODocNum: po.sapPODocNum,
    };
  }

  if (po.status !== 'Approved') {
    return {
      error: 'INVALID_STATUS',
      message: 'Purchase order must be approved before SAP creation',
    };
  }

  const pr = await PurchaseRequest.findById(po.relatedPRId);
  if (!pr?.sapPRDocEntry) {
    return { error: 'NO_SAP_PR', message: 'Related PR is missing SAP document reference' };
  }

  const previousStatus = po.status;
  await PurchaseOrder.updateOne({ _id: poId }, { $set: { status: 'Creating in SAP' } });

  const branchMap = await getBranchMap();
  const payload = mapPoToSapFromPortalRecord(po.toObject(), pr.toObject(), { branchMap });

  try {
    const sapResult = await createPO(payload);
    const docEntry = sapResult?.DocEntry;
    const docNum = sapResult?.DocNum != null ? String(sapResult.DocNum) : undefined;

    await PurchaseOrder.updateOne(
      { _id: poId },
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

    for (const poLine of po.lines) {
      const lineId = poLine.relatedPRLineId?.toString();
      const prLine = pr.lines.find((l) => l._id?.toString() === lineId);
      if (prLine) {
        prLine.orderedQty = (prLine.orderedQty || 0) + (poLine.quantity || 0);
        if (prLine.orderedQty > (prLine.quantity || 0)) {
          prLine.orderedQty = prLine.quantity || 0;
        }
      }
    }
    const prStatus = computePrOrderStatus(pr.lines);
    await PurchaseRequest.updateOne(
      { _id: pr._id },
      {
        $set: {
          status: prStatus,
          lines: pr.lines,
          sapPODocEntry: docEntry,
          sapPODocNum: docNum,
          sapPOCreationStatus: 'Success',
          sapPOErrorMessage: null,
          sapPOResponse: sapResult,
          relatedPortalPONumber: po.portalPONumber,
        },
      },
    );

    await SapIntegrationLog.create({
      documentType: 'PO',
      documentId: poId,
      action: 'CREATE_PO',
      requestPayload: payload,
      responsePayload: sapResult,
      sapDocEntry: docEntry,
      sapDocNum: docNum,
      status: 'Success',
    });

    await logApprovalHistory({
      documentType: 'PO',
      documentId: poId,
      stepName: 'SAP Integration',
      action: 'SAP Created',
      actionBy: user,
      previousStatus,
      newStatus: 'Created in SAP',
    });

    await notifyEvent('po.sap.created', {
      subject: `PO ${po.portalPONumber} created in SAP`,
      body: `Purchase Order ${po.portalPONumber} was created in SAP (DocNum: ${docNum}).`,
      relatedDocumentType: 'PO',
      relatedDocumentId: poId,
    });

    const refreshed = await PurchaseOrder.findById(poId).lean();
    return { success: true, sapPODocEntry: docEntry, sapPODocNum: docNum, po: refreshed };
  } catch (err) {
    const sapMessage = parseSapErrorMessage(err);

    await PurchaseOrder.updateOne(
      { _id: poId },
      {
        $set: {
          status: 'Failed to Create in SAP',
          sapCreationStatus: 'Failed',
          sapErrorMessage: sapMessage,
        },
      },
    );

    await SapIntegrationLog.create({
      documentType: 'PO',
      documentId: poId,
      action: 'CREATE_PO',
      requestPayload: payload,
      responsePayload: err.responseBody || null,
      status: 'Failed',
      errorMessage: sapMessage,
    });

    await logApprovalHistory({
      documentType: 'PO',
      documentId: poId,
      stepName: 'SAP Integration',
      action: 'SAP Failed',
      actionBy: user,
      comment: sapMessage,
      previousStatus,
      newStatus: 'Failed to Create in SAP',
    });

    await notifyEvent('po.sap.failed', {
      subject: `PO ${po.portalPONumber} SAP creation failed`,
      body: `Purchase Order ${po.portalPONumber} failed to create in SAP.`,
      relatedDocumentType: 'PO',
      relatedDocumentId: poId,
    });

    return { error: 'SAP_FAILED', message: sapMessage };
  }
}

export async function retrySapPurchaseOrder(poId, user) {
  await connectDB();
  const po = await PurchaseOrder.findById(poId).lean();
  if (!po) return { error: 'NOT_FOUND' };
  if (po.sapPODocEntry) {
    return { error: 'DUPLICATE_SAP', message: 'SAP PO already exists' };
  }
  if (!['Approved', 'Failed to Create in SAP'].includes(po.status)) {
    return { error: 'INVALID_STATUS', message: 'PO is not eligible for SAP retry' };
  }
  if (po.status === 'Failed to Create in SAP') {
    await PurchaseOrder.updateOne({ _id: poId }, { $set: { status: 'Approved' } });
  }
  return createSapPurchaseOrder(poId, user);
}
