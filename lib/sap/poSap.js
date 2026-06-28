import '@/models/index.js';
import PurchaseRequest from '@/models/PurchaseRequest.js';
import PurchaseOrder from '@/models/PurchaseOrder.js';
import { getSapErrorMessage } from '@/lib/sap/sapErrors.js';
import {
  logSapDuplicateGuard,
  writeSapIntegrationLog,
} from '@/lib/sap/sapIntegrationLog.js';
import { connectDB } from '@/lib/mongodb';
import { createPO } from '@/lib/sapServiceLayer.js';
import {
  mapPoToSapFromPortalRecord,
  validateStandaloneSapPoPayload,
} from '@/lib/sap/mappers/poToSap.js';
import { followUpSapPrAfterPoCreation } from '@/lib/sap/poPrFollowUpSap.js';
import { logApprovalHistory } from '@/lib/auditHistory.js';
import { notifyWorkflowEmailSafe } from '@/lib/emailNotify.js';
import { buildPoEmailContext } from '@/lib/emailContext.js';
import { PO_STATUS, poStatusesEqual } from '@/lib/poStatus.js';
import { sanitizeSapErrorForEmail } from '@/lib/sapErrorSanitize.js';

function parseSapErrorMessage(err) {
  return getSapErrorMessage(err);
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

async function failPoSapCreation({
  poId,
  po,
  previousStatus,
  user,
  payload,
  message,
  logMessage,
  responsePayload,
  errorCode,
}) {
  const userMessage = sanitizeSapErrorForEmail(message);
  const loggedError = logMessage || message;

  await PurchaseOrder.updateOne(
    { _id: poId },
    {
      $set: {
        status: PO_STATUS.FAILED_SAP,
        sapCreationStatus: 'Failed',
        sapErrorMessage: userMessage,
      },
    },
  );

  await writeSapIntegrationLog({
    documentType: 'PO',
    documentId: poId,
    action: 'CREATE_PO',
    requestPayload: payload,
    responsePayload,
    status: 'Failed',
    errorMessage: loggedError,
  });

  await logApprovalHistory({
    documentType: 'PO',
    documentId: poId,
    stepName: 'SAP Integration',
    action: 'SAP Failed',
    actionBy: user,
    comment: userMessage,
    previousStatus,
    newStatus: PO_STATUS.FAILED_SAP,
  });

  notifyWorkflowEmailSafe(
    'po.sap.failed',
    {
      ...buildPoEmailContext(po),
      status: 'Failed to Create in SAP',
      sapErrorMessage: userMessage,
      documentId: poId?.toString?.() || poId,
    },
    { documentType: 'PO', documentId: poId },
  );

  return { error: errorCode, message: userMessage };
}

/**
 * Create SAP PO from an approved portal PurchaseOrder (standalone, no PR base document).
 */
export async function createSapPurchaseOrder(poId, user) {
  await connectDB();
  const po = await PurchaseOrder.findById(poId);
  if (!po) return { error: 'NOT_FOUND' };

  if (po.sapPODocEntry) {
    await logSapDuplicateGuard({
      documentType: 'PO',
      documentId: poId,
      action: 'CREATE_PO',
      sapDocEntry: po.sapPODocEntry,
      sapDocNum: po.sapPODocNum,
      message: 'Duplicate guard: SAP PO already exists',
    });
    return {
      error: 'DUPLICATE_SAP',
      message: 'SAP PO already exists',
      sapPODocEntry: po.sapPODocEntry,
      sapPODocNum: po.sapPODocNum,
    };
  }

  if (!poStatusesEqual(po.status, PO_STATUS.APPROVED)) {
    return {
      error: 'INVALID_STATUS',
      message: 'Purchase order must be approved before SAP creation',
    };
  }

  const pr = await PurchaseRequest.findById(po.relatedPRId);
  if (!pr?.sapPRDocEntry) {
    return { error: 'NO_SAP_PR', message: 'Related PR is missing SAP document reference' };
  }

  const payload = mapPoToSapFromPortalRecord(po.toObject(), pr.toObject());
  const validation = validateStandaloneSapPoPayload(payload);
  if (!validation.ok) {
    const message = validation.errors.join('; ');
    return failPoSapCreation({
      poId,
      po,
      previousStatus: po.status,
      user,
      payload,
      message,
      responsePayload: { validationErrors: validation.errors },
      errorCode: 'SAP_VALIDATION',
    });
  }

  const previousStatus = po.status;
  await PurchaseOrder.updateOne({ _id: poId }, { $set: { status: PO_STATUS.CREATING_IN_SAP } });

  try {
    const sapResult = await createPO(payload);
    const docEntry = sapResult?.DocEntry;
    const docNum = sapResult?.DocNum != null ? String(sapResult.DocNum) : undefined;
    const createdAt = new Date();

    const followUp = await followUpSapPrAfterPoCreation({
      sapPRDocEntry: pr.sapPRDocEntry,
      sapPODocEntry: docEntry,
      sapPODocNum: docNum,
      portalPrId: pr._id.toString(),
    });

    const sapWarnings =
      followUp.warnings.length > 0 ? followUp.warnings.join('; ') : null;

    await PurchaseOrder.updateOne(
      { _id: poId },
      {
        $set: {
          status: PO_STATUS.CREATED_IN_SAP,
          sapPODocEntry: docEntry,
          sapPODocNum: docNum,
          sapCreationStatus: 'Success',
          sapPOStatus: 'created',
          sapCreatedAt: createdAt,
          sapResponse: sapResult,
          sapErrorMessage: null,
          sapWarnings,
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

    const prClosedInSap = !followUp.warnings.some((w) =>
      w.includes('could not be closed'),
    );
    const prStatus = prClosedInSap ? 'Fully Ordered' : computePrOrderStatus(pr.lines);

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

    await writeSapIntegrationLog({
      documentType: 'PO',
      documentId: poId,
      action: 'CREATE_PO',
      requestPayload: payload,
      responsePayload: sapResult,
      sapDocEntry: docEntry,
      sapDocNum: docNum,
      status: 'Success',
      errorMessage: sapWarnings,
    });

    await logApprovalHistory({
      documentType: 'PO',
      documentId: poId,
      stepName: 'SAP Integration',
      action: 'SAP Created',
      actionBy: user,
      previousStatus,
      newStatus: PO_STATUS.CREATED_IN_SAP,
      comment: sapWarnings || undefined,
    });

    notifyWorkflowEmailSafe(
      'po.sap.created',
      {
        ...buildPoEmailContext({ ...po, sapPODocNum: docNum != null ? String(docNum) : po.sapPODocNum }),
        docNum: docNum != null ? String(docNum) : undefined,
        sapWarnings,
        status: 'Created in SAP',
      },
      { documentType: 'PO', documentId: poId },
    );

    const refreshed = await PurchaseOrder.findById(poId).lean();
    return {
      success: true,
      sapPODocEntry: docEntry,
      sapPODocNum: docNum,
      po: refreshed,
      warnings: followUp.warnings,
    };
  } catch (err) {
    const sapMessage = parseSapErrorMessage(err);
    return failPoSapCreation({
      poId,
      po,
      previousStatus,
      user,
      payload,
      message: sapMessage,
      logMessage: sapMessage,
      responsePayload: err.responseBody || null,
      errorCode: 'SAP_FAILED',
    });
  }
}

export async function retrySapPurchaseOrder(poId, user) {
  await connectDB();
  const po = await PurchaseOrder.findById(poId).lean();
  if (!po) return { error: 'NOT_FOUND' };
  if (po.sapPODocEntry) {
    return { error: 'DUPLICATE_SAP', message: 'SAP PO already exists' };
  }
  if (
    poStatusesEqual(po.status, PO_STATUS.CREATING_IN_SAP)
  ) {
    return { error: 'INVALID_STATUS', message: 'SAP creation is already in progress' };
  }
  if (
    !poStatusesEqual(po.status, PO_STATUS.APPROVED) &&
    !poStatusesEqual(po.status, PO_STATUS.FAILED_SAP)
  ) {
    return { error: 'INVALID_STATUS', message: 'PO is not eligible for SAP retry' };
  }
  if (poStatusesEqual(po.status, PO_STATUS.FAILED_SAP)) {
    await PurchaseOrder.updateOne({ _id: poId }, { $set: { status: PO_STATUS.APPROVED } });
  }
  return createSapPurchaseOrder(poId, user);
}
