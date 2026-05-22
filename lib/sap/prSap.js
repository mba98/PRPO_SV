import '@/models/index.js';
import PurchaseRequest from '@/models/PurchaseRequest.js';
import SapIntegrationLog from '@/models/SapIntegrationLog.js';
import SystemSettings from '@/models/SystemSettings.js';
import { connectDB } from '@/lib/mongodb';
import { createPR } from '@/lib/sapServiceLayer.js';
import {
  buildPrSapDebugMeta,
  mapPrToSap,
  validatePrSapPayload,
} from '@/lib/sap/mappers/prToSap.js';
import { resolvePrRequesterUser } from '@/lib/sap/prRequester.js';
import { resolveDefaultSapRequesterCode } from '@/lib/sap/sapRequesterConfig.js';
import { logApprovalHistory } from '@/lib/auditHistory.js';
import { notifyEvent } from '@/lib/emailNotify.js';

export function parseRawSapErrorMessage(err) {
  return err?.responseBody?.error?.message?.value || err.message || 'SAP request failed';
}

/**
 * User-facing SAP error — ODBC -2028 kept verbatim in logs only.
 */
export function toUserFriendlySapPrError(rawMessage) {
  if (!rawMessage) return 'SAP request failed';
  if (/ODBC\s*-2028/i.test(rawMessage) || /No matching records found/i.test(rawMessage)) {
    return (
      'SAP could not find one or more referenced codes in the purchase request ' +
      '(requester, item, warehouse, project, cost center, or branch). ' +
      'Verify SAP master data and user sapRequesterCode mapping.'
    );
  }
  return rawMessage;
}

async function getSapPrSettings() {
  const [branchDoc, requesterDoc] = await Promise.all([
    SystemSettings.findOne({ key: 'branch_map' }).lean(),
    SystemSettings.findOne({ key: 'sap_default_requester' }).lean(),
  ]);

  const defaultValue = requesterDoc?.value;
  const fromSettings =
    typeof defaultValue === 'string'
      ? defaultValue
      : defaultValue?.code || defaultValue?.requesterCode || null;

  return {
    branchMap: branchDoc?.value || {},
    defaultRequesterCode: fromSettings || resolveDefaultSapRequesterCode(),
  };
}

function buildLogPayload(sapPayload, debugMeta) {
  return { sap: sapPayload, debug: debugMeta };
}

async function logSapPrAttempt({
  prId,
  logPayload,
  status,
  responsePayload,
  errorMessage,
  sapDocEntry,
  sapDocNum,
}) {
  await SapIntegrationLog.create({
    documentType: 'PR',
    documentId: prId,
    action: 'CREATE_PR',
    requestPayload: logPayload,
    responsePayload: responsePayload ?? null,
    sapDocEntry,
    sapDocNum: sapDocNum != null ? String(sapDocNum) : undefined,
    status,
    errorMessage,
  });
}

async function failPrSapCreation({
  prId,
  pr,
  previousStatus,
  user,
  logPayload,
  message,
  logMessage,
  responsePayload,
  errorCode,
}) {
  const loggedError = logMessage || message;
  await PurchaseRequest.updateOne(
    { _id: prId },
    {
      $set: {
        status: 'Failed to Create in SAP',
        sapCreationStatus: 'Failed',
        sapErrorMessage: message,
      },
    },
  );

  await logSapPrAttempt({
    prId,
    logPayload,
    status: 'Failed',
    responsePayload,
    errorMessage: loggedError,
  });

  await logApprovalHistory({
    documentType: 'PR',
    documentId: prId,
    stepName: 'SAP Integration',
    action: 'SAP Failed',
    actionBy: user,
    previousStatus,
    newStatus: 'Failed to Create in SAP',
    comment: message,
  });

  await notifyEvent('pr.sap.failed', {
    subject: `PR ${pr.portalPRNumber} SAP creation failed`,
    body: `Purchase Request ${pr.portalPRNumber} failed to create in SAP.`,
    relatedDocumentType: 'PR',
    relatedDocumentId: prId,
  });

  return { error: errorCode, message };
}

export async function createSapPurchaseRequest(prId, actingUser) {
  await connectDB();
  const pr = await PurchaseRequest.findById(prId)
    .populate('requester', 'username sapRequesterCode email name')
    .lean();
  if (!pr) {
    return { error: 'NOT_FOUND' };
  }
  if (pr.sapPRDocEntry) {
    return {
      error: 'DUPLICATE_SAP',
      message: 'SAP PR already exists',
      sapPRDocEntry: pr.sapPRDocEntry,
      sapPRDocNum: pr.sapPRDocNum,
    };
  }

  const previousStatus = pr.status;
  await PurchaseRequest.updateOne({ _id: prId }, { $set: { status: 'Creating in SAP' } });

  const requesterUser = await resolvePrRequesterUser(pr);

  const { branchMap, defaultRequesterCode } = await getSapPrSettings();
  const payload = mapPrToSap(pr, {
    branchMap,
    requesterSapCode: requesterUser?.sapRequesterCode,
    defaultRequesterCode,
  });

  const debugMeta = {
    ...buildPrSapDebugMeta(pr, payload, {
      requesterUserId: requesterUser?._id?.toString() || pr.requester?.toString?.(),
      requesterUsername: requesterUser?.username,
    }),
    actionPerformedBy: actingUser?.username,
    actionPerformedById: actingUser?._id?.toString?.() || actingUser?.id,
  };
  const logPayload = buildLogPayload(payload, debugMeta);

  const validation = validatePrSapPayload(pr, payload, {
    requesterUsername: requesterUser?.username,
  });

  if (!validation.ok) {
    const message = validation.errors.join('; ');
    return failPrSapCreation({
      prId,
      pr,
      previousStatus,
      user: actingUser,
      logPayload,
      message,
      responsePayload: { validationErrors: validation.errors },
      errorCode: 'SAP_VALIDATION',
    });
  }

  try {
    const sapResult = await createPR(payload);
    const docEntry = sapResult?.DocEntry;
    const docNum = sapResult?.DocNum;

    await PurchaseRequest.updateOne(
      { _id: prId },
      {
        $set: {
          status: 'Created in SAP',
          sapPRDocEntry: docEntry,
          sapPRDocNum: docNum != null ? String(docNum) : undefined,
          sapCreationStatus: 'Success',
          sapResponse: sapResult,
          sapErrorMessage: null,
        },
      },
    );

    await logSapPrAttempt({
      prId,
      logPayload,
      status: 'Success',
      responsePayload: sapResult,
      sapDocEntry: docEntry,
      sapDocNum: docNum,
    });

    await logApprovalHistory({
      documentType: 'PR',
      documentId: prId,
      stepName: 'SAP Integration',
      action: 'SAP Created',
      actionBy: actingUser,
      previousStatus,
      newStatus: 'Created in SAP',
    });

    await notifyEvent('pr.sap.created', {
      subject: `PR ${pr.portalPRNumber} created in SAP`,
      body: `Purchase Request ${pr.portalPRNumber} was created in SAP (DocNum: ${docNum}).`,
      relatedDocumentType: 'PR',
      relatedDocumentId: prId,
    });

    return { success: true, sapPRDocEntry: docEntry, sapPRDocNum: docNum };
  } catch (err) {
    const rawSapMessage = parseRawSapErrorMessage(err);
    const userMessage = toUserFriendlySapPrError(rawSapMessage);

    return failPrSapCreation({
      prId,
      pr,
      previousStatus,
      user: actingUser,
      logPayload,
      message: userMessage,
      logMessage: rawSapMessage,
      responsePayload: {
        rawSapError: rawSapMessage,
        sapResponseBody: err.responseBody || null,
      },
      errorCode: 'SAP_FAILED',
    });
  }
}
