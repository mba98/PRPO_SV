import '@/models/index.js';
import APReserveInvoice from '@/models/APReserveInvoice.js';
import { getSapErrorMessage } from '@/lib/sap/sapErrors.js';
import {
  logSapDuplicateGuard,
  writeSapIntegrationLog,
} from '@/lib/sap/sapIntegrationLog.js';
import { connectDB } from '@/lib/mongodb';
import { createAPReserveInvoice } from '@/lib/sapServiceLayer.js';
import { mapApReserveInvoiceToSap } from '@/lib/sap/mappers/apReserveInvoiceToSap.js';
import { logApprovalHistory } from '@/lib/auditHistory.js';
import { notifyWorkflowEmailSafe } from '@/lib/emailNotify.js';
import { buildApriEmailContext } from '@/lib/emailContext.js';

function parseSapErrorMessage(err) {
  return getSapErrorMessage(err);
}

export async function createSapApReserveInvoice(apriId, user) {
  await connectDB();
  const apri = await APReserveInvoice.findById(apriId);
  if (!apri) return { error: 'NOT_FOUND' };

  if (apri.sapAPDocEntry) {
    await logSapDuplicateGuard({
      documentType: 'APRI',
      documentId: apriId,
      action: 'CREATE_APRI',
      sapDocEntry: apri.sapAPDocEntry,
      sapDocNum: apri.sapAPDocNum,
      message: 'Duplicate guard: SAP AP Reserve Invoice already exists',
    });
    return {
      error: 'DUPLICATE_SAP',
      message: 'SAP A/P Reserve Invoice already exists',
      sapAPDocEntry: apri.sapAPDocEntry,
      sapAPDocNum: apri.sapAPDocNum,
    };
  }

  const previousStatus = apri.status;
  await APReserveInvoice.updateOne({ _id: apriId }, { $set: { status: 'Creating in SAP' } });

  let payload;
  try {
    payload = mapApReserveInvoiceToSap(apri.toObject());
  } catch (err) {
    const message = err.message || 'Invalid APRI data for SAP';
    await APReserveInvoice.updateOne(
      { _id: apriId },
      {
        $set: {
          status: 'Failed to Create in SAP',
          sapCreationStatus: 'Failed',
          sapErrorMessage: message,
        },
      },
    );
    await writeSapIntegrationLog({
      documentType: 'APRI',
      documentId: apriId,
      action: 'CREATE_APRI',
      requestPayload: null,
      responsePayload: { validationError: message },
      status: 'Failed',
      errorMessage: message,
    });
    return { error: 'INVALID_LINES', message };
  }

  try {
    const sapResult = await createAPReserveInvoice(payload);
    const docEntry = sapResult?.DocEntry;
    const docNum = sapResult?.DocNum != null ? String(sapResult.DocNum) : undefined;

    await APReserveInvoice.updateOne(
      { _id: apriId },
      {
        $set: {
          status: 'Created in SAP',
          sapAPDocEntry: docEntry,
          sapAPDocNum: docNum,
          sapCreationStatus: 'Success',
          sapResponse: sapResult,
          sapErrorMessage: null,
        },
      },
    );

    await writeSapIntegrationLog({
      documentType: 'APRI',
      documentId: apriId,
      action: 'CREATE_APRI',
      requestPayload: payload,
      responsePayload: sapResult,
      sapDocEntry: docEntry,
      sapDocNum: docNum,
      status: 'Success',
    });

    await logApprovalHistory({
      documentType: 'APRI',
      documentId: apriId,
      stepName: 'SAP Integration',
      action: 'SAP Created',
      actionBy: user,
      previousStatus,
      newStatus: 'Created in SAP',
    });

    notifyWorkflowEmailSafe(
      'apri.sap.created',
      {
        ...buildApriEmailContext({
          ...apri.toObject(),
          sapAPDocNum: docNum != null ? String(docNum) : apri.sapAPDocNum,
        }),
        docNum: docNum != null ? String(docNum) : undefined,
        status: 'Created in SAP',
      },
      { documentType: 'APRI', documentId: apriId },
    );

    const refreshed = await APReserveInvoice.findById(apriId).lean();
    return { success: true, sapAPDocEntry: docEntry, sapAPDocNum: docNum, apri: refreshed };
  } catch (err) {
    const sapMessage = parseSapErrorMessage(err);

    await APReserveInvoice.updateOne(
      { _id: apriId },
      {
        $set: {
          status: 'Failed to Create in SAP',
          sapCreationStatus: 'Failed',
          sapErrorMessage: sapMessage,
        },
      },
    );

    await writeSapIntegrationLog({
      documentType: 'APRI',
      documentId: apriId,
      action: 'CREATE_APRI',
      requestPayload: payload,
      responsePayload: err.responseBody || null,
      status: 'Failed',
      errorMessage: sapMessage,
    });

    await logApprovalHistory({
      documentType: 'APRI',
      documentId: apriId,
      stepName: 'SAP Integration',
      action: 'SAP Failed',
      actionBy: user,
      comment: sapMessage,
      previousStatus,
      newStatus: 'Failed to Create in SAP',
    });

    notifyWorkflowEmailSafe(
      'apri.sap.failed',
      {
        ...buildApriEmailContext(apri.toObject()),
        status: 'Failed to Create in SAP',
      },
      { documentType: 'APRI', documentId: apriId },
    );

    return { error: 'SAP_FAILED', message: sapMessage };
  }
}

export async function retrySapApReserveInvoice(apriId, user) {
  await connectDB();
  const apri = await APReserveInvoice.findById(apriId).lean();
  if (!apri) return { error: 'NOT_FOUND' };
  if (apri.sapAPDocEntry) {
    return { error: 'DUPLICATE_SAP', message: 'SAP document already exists' };
  }
  if (apri.status !== 'Failed to Create in SAP') {
    return { error: 'INVALID_STATUS', message: 'Only failed APRI records can be retried' };
  }
  await APReserveInvoice.updateOne({ _id: apriId }, { $set: { status: 'Creating in SAP' } });
  return createSapApReserveInvoice(apriId, user);
}
