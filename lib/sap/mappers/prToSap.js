import mongoose from 'mongoose';
import { toSapDate } from '@/lib/dateUtils.js';
import { resolveBranchId } from '@/lib/sap/sapBranchConfig.js';
import { resolveSapDepartmentUdf } from '@/lib/sap/sapDepartmentConfig.js';

const DEFAULT_REQ_TYPE = parseInt(process.env.SAP_PR_REQ_TYPE || '12', 10);
export const SAP_PR_DOC_TYPE = 'dDocument_Items';

const INVALID_SAP_OPTIONAL_CODES = new Set([
  '-',
  '—',
  'n/a',
  'na',
  'none',
  'null',
  'undefined',
  'project',
  'retail',
]);

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
 * Skip empty, dash, or placeholder optional SAP line/header codes.
 */
export function isInvalidSapOptionalCode(value) {
  const s = String(value ?? '').trim();
  if (!s) return true;
  return INVALID_SAP_OPTIONAL_CODES.has(s.toLowerCase());
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
 * SAP PurchaseRequests.Requester — string code (e.g. "12").
 */
export function normalizeSapRequesterValue(code) {
  const trimmed = String(code ?? '').trim();
  return trimmed || null;
}

/**
 * True when an optional SAP code is safe to send: present, not a placeholder,
 * and not a MongoDB ObjectId.
 */
function isUsableSapOptionalCode(value) {
  const s = String(value ?? '').trim();
  if (!s || isInvalidSapOptionalCode(s)) return false;
  if (isMongoObjectIdString(s)) return false;
  return true;
}

/**
 * Map a PR line to a SAP DocumentLine.
 *
 * Only the simplified required fields (ItemCode, Quantity, UnitPrice, and
 * RequiredDate when available) are sent by default. Optional SAP reference
 * fields (WarehouseCode, ProjectCode, CostingCode, U_Department, U_DelDate,
 * U_Rate) are omitted unless explicitly opted in via options AND the supplied
 * code is valid — this avoids "referenced code not found" SAP errors.
 */
function mapPrLineToSap(line, pr, options = {}) {
  const docLine = {
    ItemCode: line.itemCode,
    Quantity: line.quantity,
    UnitPrice: line.estimatedUnitPrice,
  };

  const requiredDate = toSapDate(line.requiredDate || pr.requiredDate);
  if (requiredDate) {
    docLine.RequiredDate = requiredDate;
  }

  if (options.includeWarehouseCode) {
    const warehouseCode = line.warehouseCode || pr.warehouse;
    if (isUsableSapOptionalCode(warehouseCode)) {
      docLine.WarehouseCode = String(warehouseCode).trim();
    }
  }

  if (options.includeProjectCode) {
    const projectCode = line.projectCode || pr.project;
    if (isUsableSapOptionalCode(projectCode)) {
      docLine.ProjectCode = String(projectCode).trim();
    }
  }

  if (options.includeCostingCode) {
    if (isUsableSapOptionalCode(line.costCenter)) {
      docLine.CostingCode = String(line.costCenter).trim();
    }
  }

  if (options.includeUdfs) {
    if (isUsableSapOptionalCode(line.uDepartment)) {
      docLine.U_Department = String(line.uDepartment).trim();
    }
    const uDelDate = toSapDate(line.uDelDate);
    if (uDelDate) docLine.U_DelDate = uDelDate;
    if (line.uRate != null && line.uRate !== '') docLine.U_Rate = line.uRate;
  }

  return docLine;
}

/**
 * Human-readable list of SAP codes sent (for failed-PR troubleshooting).
 */
export function formatSapReferenceSummary(payload, debugMeta) {
  const header = debugMeta?.header || {};
  const lines = debugMeta?.lines || payload?.DocumentLines || [];
  const parts = [
    `Requester=${debugMeta?.sapRequesterCode ?? payload?.Requester ?? '—'}`,
    `Branch=${header.BPL_IDAssignedToInvoice ?? payload?.BPL_IDAssignedToInvoice ?? '—'}`,
    `ReqType=${header.ReqType ?? payload?.ReqType ?? '—'}`,
    `DocType=${header.DocType ?? payload?.DocType ?? '—'}`,
  ];
  lines.forEach((line, i) => {
    const n = i + 1;
    const segments = [
      `Item=${line.ItemCode || '—'}`,
      `Qty=${line.Quantity ?? '—'}`,
      `UnitPrice=${line.UnitPrice ?? '—'}`,
    ];
    // Optional reference codes are only shown when actually sent.
    if (line.WarehouseCode) segments.push(`Whs=${line.WarehouseCode}`);
    if (line.ProjectCode) segments.push(`Project=${line.ProjectCode}`);
    if (line.CostingCode) segments.push(`CostCenter=${line.CostingCode}`);
    parts.push(`Line ${n}: ${segments.join(', ')}`);
  });
  return parts.join('; ');
}

/**
 * Validate SAP reference fields before Service Layer POST (structural — not live SAP lookups).
 */
export function validatePrSapPayload(pr, payload, context = {}) {
  const errors = [];
  const username = context.requesterUsername || 'unknown';
  const department = pr.department?.trim() || 'unknown';

  const requester = payload.Requester;
  if (requester == null || requester === '') {
    errors.push(`Missing SAP requester code for PR requester ${username}`);
  } else if (isMongoObjectIdString(requester)) {
    errors.push(`Requester must be a valid SAP employee code, not a MongoDB id (${requester})`);
  } else if (String(requester).includes('@')) {
    errors.push(`Requester must be a SAP employee code, not an email (${requester})`);
  }

  if (payload.BPL_IDAssignedToInvoice == null || Number.isNaN(Number(payload.BPL_IDAssignedToInvoice))) {
    errors.push(`Missing SAP branch mapping for department ${department}`);
  }

  if (!payload.DocType?.trim()) {
    errors.push('DocType is required for item-based purchase requests');
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
    // WarehouseCode is optional in the simplified flow; only validate format
    // when a code was explicitly sent.
    const whs = line.WarehouseCode?.trim();
    if (whs && isMongoObjectIdString(whs)) {
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
      DocType: payload.DocType,
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
      UnitPrice: line.UnitPrice,
    })),
  };
}

/**
 * MongoDB PurchaseRequest → SAP Service Layer /PurchaseRequests payload.
 */
export function mapPrToSap(pr, options = {}) {
  const branchMap = options.branchMap || {};
  const departmentMap = options.departmentMap || {};
  const requesterSapCode = resolveRequesterSapCode(pr, options);

  const payload = {
    ReqType: options.reqType ?? DEFAULT_REQ_TYPE,
    DocType: options.docType ?? SAP_PR_DOC_TYPE,
    ReqDate: toSapDate(pr.requiredDate),
    DocDate: toSapDate(pr.documentDate || pr.requiredDate),
    DocDueDate: toSapDate(pr.requiredDate),
    BPL_IDAssignedToInvoice: resolveBranchId(pr.department, branchMap),
    DocumentLines: (pr.lines || []).map((line) => mapPrLineToSap(line, pr, options)),
  };

  // Comments only when remarks were actually provided.
  const remarks = (pr.remarks || '').trim();
  if (remarks) {
    payload.Comments = remarks;
  }

  // U_Department UDF is omitted by default; opt in only when explicitly requested.
  if (options.includeUdfs) {
    const departmentUdf = resolveSapDepartmentUdf(pr.department, departmentMap);
    if (departmentUdf) {
      payload.U_Department = departmentUdf;
    }
  }

  if (requesterSapCode) {
    payload.Requester = normalizeSapRequesterValue(requesterSapCode);
  }

  return payload;
}

// Re-export for tests that import resolveBranchId from prToSap.
export { resolveBranchId };
