import { userHasEffectivePermission } from '@/lib/effectivePermissions.js';
import { getEffectivePermissions } from '@/lib/effectivePermissions.js';

export const APRI_VIEW_FINANCIALS_PERMISSION = 'apri.view.financials';

export function userCanViewApriFinancials(user) {
  if (!user) return false;
  if (userHasEffectivePermission(user, APRI_VIEW_FINANCIALS_PERMISSION)) return true;
  if (userHasEffectivePermission(user, 'apri.create')) return true;
  if (userHasEffectivePermission(user, 'apinvoice.create')) return true;
  if (userHasEffectivePermission(user, 'admin.settings')) return true;
  return false;
}

export function userIsWarehouseApriApproverOnly(user) {
  const permissions = getEffectivePermissions(user);
  const hasWhs = permissions.includes('apri.approve.whs') || permissions.includes('pr.approve.whs');
  const hasFinancial = userCanViewApriFinancials(user);
  return hasWhs && !hasFinancial;
}

export function sanitizeApriFinancialFields(document, canViewFinancials) {
  if (!document || canViewFinancials) return document;

  const lines = (document.lines || []).map((line) => ({
    _id: line._id,
    itemCode: line.itemCode,
    itemName: line.itemName,
    quantity: line.quantity,
    uomCode: line.uomCode ?? line.uom,
    uom: line.uom ?? line.uomCode,
    relatedPOLineId: line.relatedPOLineId,
    poQuantity: line.poQuantity,
    previouslyUsedQuantity: line.previouslyUsedQuantity,
    remainingPoQuantity: line.remainingPoQuantity,
  }));

  return {
    id: document.id,
    portalAPNumber: document.portalAPNumber,
    relatedPOId: document.relatedPOId,
    relatedPONumber: document.relatedPONumber,
    relatedSAPPODocEntry: document.relatedSAPPODocEntry,
    relatedSAPPODocNum: document.relatedSAPPODocNum,
    vendor: document.vendor,
    postingDate: document.postingDate,
    documentDate: document.documentDate,
    dueDate: document.dueDate,
    taxDate: document.taxDate,
    remarks: document.remarks,
    status: document.status,
    currentApprovalStep: document.currentApprovalStep,
    sapAPDocEntry: document.sapAPDocEntry,
    sapAPDocNum: document.sapAPDocNum,
    sapCreationStatus: document.sapCreationStatus,
    sapErrorMessage: document.sapErrorMessage,
    lines,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    __v: document.__v,
    canViewFinancials: false,
  };
}
