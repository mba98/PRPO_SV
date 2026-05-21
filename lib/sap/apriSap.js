import '@/models/index.js';
import APReserveInvoice from '@/models/APReserveInvoice.js';
import SapIntegrationLog from '@/models/SapIntegrationLog.js';
import { connectDB } from '@/lib/mongodb';
import { createAPReserveInvoice } from '@/lib/sapServiceLayer.js';
import { mapApReserveInvoiceToSap } from '@/lib/sap/mappers/apReserveInvoiceToSap.js';
import { logApprovalHistory } from '@/lib/auditHistory.js';
import { notifyEvent } from '@/lib/emailNotify.js';

function parseSapErrorMessage(err) {
  return err?.responseBody?.error?.message?.value || err.message || 'SAP request failed';
}

export async function createSapApReserveInvoice(apriId, user) {
  await connectDB();
  const apri = await APReserveInvoice.findById(apriId);
  if (!apri) return { error: 'NOT_FOUND' };

  if (apri.sapAPDocEntry) {
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

    await SapIntegrationLog.create({
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

    await notifyEvent('apri.sap.created', {
      subject: `AP Reserve Invoice ${apri.portalAPNumber} created in SAP`,
      body: `A/P Reserve Invoice ${apri.portalAPNumber} was created in SAP (DocNum: ${docNum}).`,
      relatedDocumentType: 'APRI',
      relatedDocumentId: apriId,
    });

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

    await SapIntegrationLog.create({
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

    await notifyEvent('apri.sap.failed', {
      subject: `AP Reserve Invoice ${apri.portalAPNumber} SAP creation failed`,
      body: `A/P Reserve Invoice ${apri.portalAPNumber} failed to create in SAP.`,
      relatedDocumentType: 'APRI',
      relatedDocumentId: apriId,
    });

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
