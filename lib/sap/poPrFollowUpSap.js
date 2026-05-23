import {
  closePurchaseRequest as slClosePurchaseRequest,
  getPurchaseRequest,
  patchPurchaseRequest,
} from '@/lib/sapServiceLayer.js';
import SapIntegrationLog from '@/models/SapIntegrationLog.js';

function parseSapErrorMessage(err) {
  return err?.responseBody?.error?.message?.value || err.message || 'SAP request failed';
}

export function buildPrCloseCommentAppendix(sapPODocEntry, sapPODocNum) {
  return `Closed after creating standalone PO DocEntry ${sapPODocEntry} / DocNum ${sapPODocNum}`;
}

/**
 * Append text to SAP PR Comments (preserves existing comment).
 */
export async function appendSapPurchaseRequestComment(sapPRDocEntry, appendText, logContext = {}) {
  let existingComments = '';
  try {
    const current = await getPurchaseRequest(sapPRDocEntry);
    existingComments = (current?.Comments || '').trim();
  } catch (err) {
    const message = parseSapErrorMessage(err);
    await SapIntegrationLog.create({
      documentType: 'PR',
      documentId: logContext.portalPrId,
      action: 'PATCH_PR_COMMENT_READ',
      requestPayload: { sapPRDocEntry },
      status: 'Failed',
      errorMessage: message,
    }).catch(() => {});
    throw err;
  }

  const combined = existingComments
    ? `${existingComments}\n${appendText}`
    : appendText;

  try {
    const result = await patchPurchaseRequest(sapPRDocEntry, { Comments: combined });
    await SapIntegrationLog.create({
      documentType: 'PR',
      documentId: logContext.portalPrId,
      action: 'PATCH_PR_COMMENT',
      requestPayload: { sapPRDocEntry, Comments: combined },
      responsePayload: result,
      sapDocEntry: sapPRDocEntry,
      status: 'Success',
    }).catch(() => {});
    return result;
  } catch (err) {
    const message = parseSapErrorMessage(err);
    await SapIntegrationLog.create({
      documentType: 'PR',
      documentId: logContext.portalPrId,
      action: 'PATCH_PR_COMMENT',
      requestPayload: { sapPRDocEntry, Comments: combined },
      responsePayload: err.responseBody || null,
      status: 'Failed',
      errorMessage: message,
    }).catch(() => {});
    throw err;
  }
}

/**
 * Close SAP PR after standalone PO was created. Does not throw on failure — returns warning text.
 */
export async function closeSapPurchaseRequestAfterPo(sapPRDocEntry, logContext = {}) {
  try {
    const result = await slClosePurchaseRequest(sapPRDocEntry);
    await SapIntegrationLog.create({
      documentType: 'PR',
      documentId: logContext.portalPrId,
      action: 'CLOSE_PR',
      requestPayload: { sapPRDocEntry },
      responsePayload: result,
      sapDocEntry: sapPRDocEntry,
      status: 'Success',
    }).catch(() => {});
    return { ok: true };
  } catch (err) {
    const message = parseSapErrorMessage(err);
    console.error('[sap-po] SAP PR close failed:', message);
    await SapIntegrationLog.create({
      documentType: 'PR',
      documentId: logContext.portalPrId,
      action: 'CLOSE_PR',
      requestPayload: { sapPRDocEntry },
      responsePayload: err.responseBody || null,
      status: 'Failed',
      errorMessage: message,
    }).catch(() => {});
    return {
      ok: false,
      warning: 'SAP PO created, but related SAP PR could not be closed',
      detail: message,
    };
  }
}

/**
 * After successful SAP PO: update PR comment, then close PR. Collects non-fatal warnings.
 */
export async function followUpSapPrAfterPoCreation({
  sapPRDocEntry,
  sapPODocEntry,
  sapPODocNum,
  portalPrId,
}) {
  const warnings = [];
  const appendix = buildPrCloseCommentAppendix(sapPODocEntry, sapPODocNum);

  try {
    await appendSapPurchaseRequestComment(sapPRDocEntry, appendix, { portalPrId });
  } catch (err) {
    const message = parseSapErrorMessage(err);
    console.error('[sap-po] SAP PR comment update failed:', message);
    warnings.push(`SAP PR comment could not be updated: ${message}`);
  }

  const closeResult = await closeSapPurchaseRequestAfterPo(sapPRDocEntry, { portalPrId });
  if (!closeResult.ok) {
    warnings.push(closeResult.warning);
    if (closeResult.detail) {
      warnings.push(closeResult.detail);
    }
  }

  return { warnings };
}
