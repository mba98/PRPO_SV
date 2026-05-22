import mongoose from 'mongoose';
import { toSapDate } from '@/lib/dateUtils.js';

const DEFAULT_REQ_TYPE = parseInt(process.env.SAP_PR_REQ_TYPE || '12', 10);

/**
 * True when value looks like a 24-char MongoDB ObjectId (invalid SAP master-data code).
 */
export function isMongoObjectIdString(value) {
  if (value == null) return false;
  const s = String(value).trim();
  if (!/^[a-f0-9]{24}$/i.test(s)) return false;
  return mongoose.Types.ObjectId.isValid(s);
}

/**
 * Resolve branch ID from system_settings.branch_map or env default.
 */
export function resolveBranchId(department, branchMap = {}) {
  if (department && branchMap[department] != null) {
    return branchMap[department];
  }
  const envDefault = process.env.SAP_DEFAULT_BRANCH_ID;
  if (envDefault) return parseInt(envDefault, 10);
  return 1;
}

/**
 * SAP employee / requester code — never a MongoDB ObjectId.
 */
export function resolveRequesterSapCode(pr, options = {}) {
  const explicit = options.requesterSapCode?.trim();
  if (explicit && !isMongoObjectIdString(explicit)) {
    return explicit;
  }

  const defaultCode =
    typeof options.defaultRequesterCode === 'string'
      ? options.defaultRequesterCode.trim()
      : options.defaultRequesterCode?.code?.trim?.() || '';
  if (defaultCode && !isMongoObjectIdString(defaultCode)) {
    return defaultCode;
  }

  const legacy = pr.requesterEmail?.trim();
  if (legacy && !isMongoObjectIdString(legacy) && !legacy.includes('@')) {
    return legacy;
  }

  return null;
}

/**
 * Validate SAP reference fields before Service Layer POST (structural — not live SAP lookups).
 */
export function validatePrSapPayload(pr, payload, context = {}) {
  const errors = [];
  const username = context.requesterUsername || 'unknown';

  const requester = payload.Requester;
  if (requester == null || requester === '') {
    errors.push(`Missing SAP requester code for PR requester ${username}`);
  } else if (isMongoObjectIdString(requester)) {
    errors.push(`Requester must be a valid SAP employee code, not a MongoDB id (${requester})`);
  } else if (String(requester).includes('@')) {
    errors.push(`Requester must be a SAP employee code, not an email (${requester})`);
  }

  if (payload.BPL_IDAssignedToInvoice == null || Number.isNaN(Number(payload.BPL_IDAssignedToInvoice))) {
    errors.push('Branch (BPL_IDAssignedToInvoice) is missing or invalid');
  }

  const lines = payload.DocumentLines || [];
  if (lines.length === 0) {
    errors.push('At least one document line is required');
  }

  lines.forEach((line, index) => {
    const n = index + 1;
    if (!line.ItemCode?.trim()) {
      errors.push(`Line ${n}: ItemCode is required`);
    } else if (isMongoObjectIdString(line.ItemCode)) {
      errors.push(`Line ${n}: ItemCode must not be a MongoDB id`);
    }
    const whs = line.WarehouseCode?.trim();
    if (!whs) {
      errors.push(`Line ${n}: WarehouseCode is required`);
    } else if (isMongoObjectIdString(whs)) {
      errors.push(`Line ${n}: WarehouseCode must not be a MongoDB id`);
    }
    const project = line.ProjectCode?.trim();
    if (project && isMongoObjectIdString(project)) {
      errors.push(`Line ${n}: ProjectCode must not be a MongoDB id`);
    }
    const costing = line.CostingCode?.trim();
    if (costing && isMongoObjectIdString(costing)) {
      errors.push(`Line ${n}: CostingCode must not be a MongoDB id`);
    }
  });

  if (!pr.department?.trim()) {
    errors.push('Department is required for branch mapping');
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Safe metadata for sap_integration_logs (no secrets).
 */
export function buildPrSapDebugMeta(pr, payload, context = {}) {
  return {
    portalPRNumber: pr.portalPRNumber,
    documentId: pr._id?.toString?.() || pr._id,
    requesterUserId: context.requesterUserId || pr.requester?.toString?.() || pr.requester,
    requesterUsername: context.requesterUsername,
    sapRequesterCode: payload.Requester ?? null,
    header: {
      ReqType: payload.ReqType,
      BPL_IDAssignedToInvoice: payload.BPL_IDAssignedToInvoice,
      U_Department: payload.U_Department,
      ReqDate: payload.ReqDate,
      DocDate: payload.DocDate,
    },
    lines: (payload.DocumentLines || []).map((line) => ({
      ItemCode: line.ItemCode,
      WarehouseCode: line.WarehouseCode,
      ProjectCode: line.ProjectCode,
      CostingCode: line.CostingCode,
      Quantity: line.Quantity,
    })),
  };
}

/**
 * MongoDB PurchaseRequest → SAP Service Layer /PurchaseRequests payload.
 */
export function mapPrToSap(pr, options = {}) {
  const branchMap = options.branchMap || {};
  const requesterSapCode = resolveRequesterSapCode(pr, options);

  const payload = {
    ReqType: options.reqType ?? DEFAULT_REQ_TYPE,
    ReqDate: toSapDate(pr.requiredDate),
    DocDate: toSapDate(pr.documentDate || pr.requiredDate),
    DocDueDate: toSapDate(pr.requiredDate),
    Comments: pr.remarks || '',
    BPL_IDAssignedToInvoice: resolveBranchId(pr.department, branchMap),
    U_Department: pr.department,
    DocumentLines: (pr.lines || []).map((line) => ({
      ItemCode: line.itemCode,
      Quantity: line.quantity,
      WarehouseCode: line.warehouseCode || pr.warehouse,
      ProjectCode: line.projectCode || pr.project,
      CostingCode: line.costCenter,
      UnitPrice: line.estimatedUnitPrice,
      RequiredDate: toSapDate(line.requiredDate || pr.requiredDate),
      U_Department: line.uDepartment,
      U_DelDate: toSapDate(line.uDelDate),
      U_Rate: line.uRate,
    })),
  };

  if (requesterSapCode) {
    payload.Requester = requesterSapCode;
  }

  return payload;
}
