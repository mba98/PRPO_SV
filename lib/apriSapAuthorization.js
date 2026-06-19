import { normalizeId } from '@/lib/normalizeId.js';
import { normalizeUserPermissionKeys } from '@/lib/permissionKeys.js';
import { apriSavedQuantitiesAreValid } from '@/lib/apriLineQuantityLimits.js';
import {
  APRI_STATUS,
  isApriCreatedInSap,
  isApriReadyForSapCreation,
  isApriSapInProgress,
  normalizeApriStatus,
} from '@/lib/apriStatus.js';

export const CREATE_IN_SAP_BLOCK_REASON = Object.freeze({
  MISSING_PERMISSION: 'MISSING_PERMISSION',
  NOT_DOCUMENT_OWNER: 'NOT_DOCUMENT_OWNER',
  INVALID_STATUS: 'INVALID_STATUS',
  SAP_DOCUMENT_ALREADY_EXISTS: 'SAP_DOCUMENT_ALREADY_EXISTS',
  DOCUMENT_ALREADY_CREATING: 'DOCUMENT_ALREADY_CREATING',
  INVALID_QUANTITIES: 'INVALID_QUANTITIES',
  MISSING_PO_REFERENCE: 'MISSING_PO_REFERENCE',
});

export function userIsApriOwner(user, apri) {
  const creatorId =
    normalizeId(apri?.createdBy) ||
    normalizeId(apri?.requester) ||
    normalizeId(apri?.createdByUser);
  const userId = normalizeId(user?._id || user?.id);
  return Boolean(creatorId && userId && creatorId === userId);
}

export function resolveApriSapCreationAccess(user, apri, { log = false } = {}) {
  const permissions = normalizeUserPermissionKeys(user);
  const hasCreateSapPermission = permissions.includes('apri.create.sap');
  const hasAdminOverride = permissions.includes('admin.settings');
  const isOwner = userIsApriOwner(user, apri);
  const normalizedStatus = normalizeApriStatus(apri?.status);
  const hasSapDocument = Boolean(apri?.sapAPDocEntry || apri?.sapAPDocNum);
  const quantitiesValid = apriSavedQuantitiesAreValid(apri?.lines);
  const relatedPoId = apri?.relatedPOId?._id?.toString?.() || apri?.relatedPOId?.toString?.() || apri?.relatedPOId;

  let createInSapBlockReason = null;
  let canCreateInSap = false;

  if (!hasCreateSapPermission) {
    createInSapBlockReason = CREATE_IN_SAP_BLOCK_REASON.MISSING_PERMISSION;
  } else if (!isOwner && !hasAdminOverride) {
    createInSapBlockReason = CREATE_IN_SAP_BLOCK_REASON.NOT_DOCUMENT_OWNER;
  } else if (!relatedPoId) {
    createInSapBlockReason = CREATE_IN_SAP_BLOCK_REASON.MISSING_PO_REFERENCE;
  } else if (hasSapDocument || isApriCreatedInSap(apri?.status)) {
    createInSapBlockReason = CREATE_IN_SAP_BLOCK_REASON.SAP_DOCUMENT_ALREADY_EXISTS;
  } else if (isApriSapInProgress(apri?.status)) {
    createInSapBlockReason = CREATE_IN_SAP_BLOCK_REASON.DOCUMENT_ALREADY_CREATING;
  } else if (!isApriReadyForSapCreation(apri?.status)) {
    createInSapBlockReason = CREATE_IN_SAP_BLOCK_REASON.INVALID_STATUS;
  } else if (!quantitiesValid) {
    createInSapBlockReason = CREATE_IN_SAP_BLOCK_REASON.INVALID_QUANTITIES;
  } else {
    canCreateInSap = true;
    createInSapBlockReason = null;
  }

  const result = {
    canCreateInSap,
    createInSapBlockReason,
    hasCreateSapPermission,
    hasAdminOverride,
    isOwner,
    normalizedStatus,
    hasSapDocument,
    quantitiesValid,
  };

  if (log && process.env.NODE_ENV !== 'production') {
    console.log('APRI SAP creation authorization', {
      apriId: normalizeId(apri?._id || apri?.id),
      status: apri?.status,
      normalizedStatus,
      createdBy: apri?.createdBy,
      currentUserId: normalizeId(user?._id || user?.id),
      currentUserRole: user?.roleName || user?.role?.name,
      permissions,
      hasCreateSapPermission,
      isOwner,
      hasAdminOverride,
      hasSapDocument,
      quantitiesValid,
      canCreateInSap,
      createInSapBlockReason,
    });
  }

  return result;
}

export function userCanPerformApriSapAction(user, apri) {
  const { hasCreateSapPermission, isOwner, hasAdminOverride } = resolveApriSapCreationAccess(
    user,
    apri,
  );
  return hasCreateSapPermission && (isOwner || hasAdminOverride);
}

export function userCanCreateApriInSap(user, apri) {
  return resolveApriSapCreationAccess(user, apri).canCreateInSap;
}

export function isApriReturnedForProcurementAction(status) {
  const norm = normalizeApriStatus(status);
  return norm === APRI_STATUS.WAREHOUSE_APPROVED || norm === APRI_STATUS.WAREHOUSE_REJECTED;
}
