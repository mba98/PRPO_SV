import '@/models/index.js';
import PurchaseRequest from '@/models/PurchaseRequest.js';
import SapIntegrationLog from '@/models/SapIntegrationLog.js';
import SystemSettings from '@/models/SystemSettings.js';
import { connectDB } from '@/lib/mongodb';
import { createPR } from '@/lib/sapServiceLayer.js';
import {
  buildPrSapDebugMeta,
  formatSapReferenceSummary,
  mapPrToSap,
  validatePrSapPayload,
} from '@/lib/sap/mappers/prToSap.js';
import { resolvePrRequesterUser } from '@/lib/sap/prRequester.js';
import { resolveDefaultSapRequesterCode } from '@/lib/sap/sapRequesterConfig.js';
import { logApprovalHistory } from '@/lib/auditHistory.js';
import { notifyWorkflowEmailSafe } from '@/lib/emailNotify.js';
import { buildPrEmailContext } from '@/lib/emailContext.js';

export function parseRawSapErrorMessage(err) {
  return err?.responseBody?.error?.message?.value || err.message || 'SAP request failed';
}

/**
 * User-facing SAP error — ODBC -2028 kept verbatim in logs only.
 */
export function toUserFriendlySapPrError(rawMessage, referenceSummary) {
  if (!rawMessage) return 'SAP request failed';
  if (/ODBC\s*-2028/i.test(rawMessage) || /No matching records found/i.test(rawMessage)) {
    let message =
      'SAP could not find one or more referenced codes in the purchase request ' +
      '(requester, item, warehouse, project, cost center, or branch). ' +
      'Verify SAP master data and user sapRequesterCode mapping.';
    if (referenceSummary) {
      message += ` Values sent: ${referenceSummary}.`;
    }
    if (/CostCenter=Project/i.test(referenceSummary || '')) {
      message +=
        ' Cost center "Project" is often invalid — clear cost center or pick a code from the SAP cost center list.';
    }
    return message;
  }
  return rawMessage;
}

async function getSapPrSettings() {
  const requesterDoc = await SystemSettings.findOne({ key: 'sap_default_requester' }).lean();

  const defaultValue = requesterDoc?.value;
  const fromSettings =
    typeof defaultValue === 'string'
      ? defaultValue
      : defaultValue?.code || defaultValue?.requesterCode || null;

  return {
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

  notifyWorkflowEmailSafe(
    'pr.sap.failed',
    {
      ...buildPrEmailContext(pr),
      status: 'Failed to Create in SAP',
    },
    { documentType: 'PR', documentId: prId },
  );

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

  const { defaultRequesterCode } = await getSapPrSettings();
  const payload = mapPrToSap(pr, {
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

    notifyWorkflowEmailSafe(
      'pr.sap.created',
      {
        ...buildPrEmailContext({ ...pr, sapPRDocNum: docNum != null ? String(docNum) : pr.sapPRDocNum }),
        docNum: docNum != null ? String(docNum) : undefined,
        status: 'Created in SAP',
      },
      { documentType: 'PR', documentId: prId },
    );

    return { success: true, sapPRDocEntry: docEntry, sapPRDocNum: docNum };
  } catch (err) {
    const rawSapMessage = parseRawSapErrorMessage(err);
    const referenceSummary = formatSapReferenceSummary(payload, debugMeta);
    const userMessage = toUserFriendlySapPrError(rawSapMessage, referenceSummary);

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
