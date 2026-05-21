import '@/models/index.js';
import PurchaseRequest from '@/models/PurchaseRequest.js';
import SapIntegrationLog from '@/models/SapIntegrationLog.js';
import SystemSettings from '@/models/SystemSettings.js';
import { connectDB } from '@/lib/mongodb';
import { createPR } from '@/lib/sapServiceLayer.js';
import { mapPrToSap } from '@/lib/sap/mappers/prToSap.js';
import { logApprovalHistory } from '@/lib/auditHistory.js';
import { notifyEvent } from '@/lib/emailNotify.js';

function parseSapErrorMessage(err) {
  return err?.responseBody?.error?.message?.value || err.message || 'SAP request failed';
}

async function getBranchMap() {
  const doc = await SystemSettings.findOne({ key: 'branch_map' }).lean();
  return doc?.value || {};
}

export async function createSapPurchaseRequest(prId, user) {
  await connectDB();
  const pr = await PurchaseRequest.findById(prId).lean();
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

  const branchMap = await getBranchMap();
  const payload = mapPrToSap(pr, { branchMap });

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

    await SapIntegrationLog.create({
      documentType: 'PR',
      documentId: prId,
      action: 'CREATE_PR',
      requestPayload: payload,
      responsePayload: sapResult,
      sapDocEntry: docEntry,
      sapDocNum: docNum != null ? String(docNum) : undefined,
      status: 'Success',
    });

    await logApprovalHistory({
      documentType: 'PR',
      documentId: prId,
      stepName: 'SAP Integration',
      action: 'SAP Created',
      actionBy: user,
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
    const sapMessage = parseSapErrorMessage(err);
    await PurchaseRequest.updateOne(
      { _id: prId },
      {
        $set: {
          status: 'Failed to Create in SAP',
          sapCreationStatus: 'Failed',
          sapErrorMessage: sapMessage,
        },
      },
    );

    await SapIntegrationLog.create({
      documentType: 'PR',
      documentId: prId,
      action: 'CREATE_PR',
      requestPayload: payload,
      responsePayload: err.responseBody || null,
      status: 'Failed',
      errorMessage: sapMessage,
    });

    await logApprovalHistory({
      documentType: 'PR',
      documentId: prId,
      stepName: 'SAP Integration',
      action: 'SAP Failed',
      actionBy: user,
      previousStatus,
      newStatus: 'Failed to Create in SAP',
      comment: sapMessage,
    });

    await notifyEvent('pr.sap.failed', {
      subject: `PR ${pr.portalPRNumber} SAP creation failed`,
      body: `Purchase Request ${pr.portalPRNumber} failed to create in SAP.`,
      relatedDocumentType: 'PR',
      relatedDocumentId: prId,
    });

    return { error: 'SAP_FAILED', message: sapMessage };
  }
}
