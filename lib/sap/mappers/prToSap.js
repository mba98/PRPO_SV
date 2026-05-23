import mongoose from 'mongoose';
import { toSapDate } from '@/lib/dateUtils.js';
import { resolveLineWarehouseCode } from '@/lib/sap/sapWarehouseConfig.js';
import { resolveLineUomCode } from '@/lib/sap/uomCode.js';

const DEFAULT_REQ_TYPE = parseInt(process.env.SAP_PR_REQ_TYPE || '12', 10);

/** SAP Service Layer header date field (intentional SAP misspelling). */
export const SAP_PR_REQUIRED_DATE_FIELD = 'RequriedDate';

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
 * Skip empty, dash, or placeholder optional SAP codes.
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
 * SAP PurchaseRequests.Requester — string code (e.g. "manager").
 */
export function normalizeSapRequesterValue(code) {
  const trimmed = String(code ?? '').trim();
  return trimmed || null;
}

function mapPrLineToSap(line, pr) {
  const docLine = {
    ItemCode: line.itemCode,
    Quantity: line.quantity,
  };

  if (line.estimatedUnitPrice != null && line.estimatedUnitPrice !== '') {
    docLine.UnitPrice = line.estimatedUnitPrice;
  }

  const requiredDate = toSapDate(line.requiredDate || pr.requiredDate);
  if (requiredDate) {
    docLine.RequiredDate = requiredDate;
  }

  const warehouseCode = resolveLineWarehouseCode(line, pr);
  if (warehouseCode && !isInvalidSapOptionalCode(warehouseCode) && !isMongoObjectIdString(warehouseCode)) {
    docLine.WarehouseCode = warehouseCode;
  }

  const vendor = (line.vendor || '').trim();
  if (vendor && !isInvalidSapOptionalCode(vendor) && !isMongoObjectIdString(vendor)) {
    docLine.LineVendor = vendor;
  }

  const uomCode = resolveLineUomCode(line);
  if (uomCode) {
    docLine.UoMCode = uomCode;
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
    `ReqType=${header.ReqType ?? payload?.ReqType ?? '—'}`,
    `${SAP_PR_REQUIRED_DATE_FIELD}=${header.RequriedDate ?? payload?.RequriedDate ?? '—'}`,
  ];
  lines.forEach((line, i) => {
    const n = i + 1;
    const segments = [
      `Item=${line.ItemCode || '—'}`,
      line.WarehouseCode ? `Whs=${line.WarehouseCode}` : null,
      line.LineVendor ? `Vendor=${line.LineVendor}` : null,
      `Qty=${line.Quantity ?? '—'}`,
      `UnitPrice=${line.UnitPrice ?? '—'}`,
    ].filter(Boolean);
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

  const requester = payload.Requester;
  if (requester == null || requester === '') {
    errors.push(`Missing SAP requester code for PR requester ${username}`);
  } else if (isMongoObjectIdString(requester)) {
    errors.push(`Requester must be a valid SAP employee code, not a MongoDB id (${requester})`);
  } else if (String(requester).includes('@')) {
    errors.push(`Requester must be a SAP employee code, not an email (${requester})`);
  }

  if (!payload.RequriedDate?.trim()) {
    errors.push('RequriedDate is required');
  }

  if (payload.ReqDate != null) {
    errors.push('ReqDate must not be sent at header level; use RequriedDate');
  }

  if (payload.RequiredDate != null) {
    errors.push('RequiredDate must not be sent at header level; use RequriedDate');
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
    if (whs && isMongoObjectIdString(whs)) {
      errors.push(`Line ${n}: WarehouseCode must not be a MongoDB id`);
    }
    const vendor = line.LineVendor?.trim();
    if (vendor && isMongoObjectIdString(vendor)) {
      errors.push(`Line ${n}: LineVendor must not be a MongoDB id`);
    }
  });

  if (!pr.requiredDate) {
    errors.push('PR required date is required');
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
      RequriedDate: payload.RequriedDate,
      DocDate: payload.DocDate,
      DocDueDate: payload.DocDueDate,
    },
    lines: (payload.DocumentLines || []).map((line) => ({
      ItemCode: line.ItemCode,
      WarehouseCode: line.WarehouseCode,
      LineVendor: line.LineVendor,
      Quantity: line.Quantity,
      UnitPrice: line.UnitPrice,
      RequiredDate: line.RequiredDate,
      UoMCode: line.UoMCode,
    })),
  };
}

/**
 * MongoDB PurchaseRequest → SAP Service Layer /PurchaseRequests payload.
 * Matches confirmed working Postman payload shape.
 */
export function mapPrToSap(pr, options = {}) {
  const requesterSapCode = resolveRequesterSapCode(pr, options);
  const requriedDate = toSapDate(pr.requiredDate);
  const docDate = toSapDate(pr.documentDate || pr.requiredDate);
  const docDueDate = toSapDate(pr.dueDate || pr.requiredDate);

  const payload = {
    ReqType: options.reqType ?? DEFAULT_REQ_TYPE,
    DocumentLines: (pr.lines || []).map((line) => mapPrLineToSap(line, pr)),
  };

  if (requriedDate) {
    payload.RequriedDate = requriedDate;
  }
  if (docDate) {
    payload.DocDate = docDate;
  }
  if (docDueDate) {
    payload.DocDueDate = docDueDate;
  }

  const remarks = (pr.remarks || '').trim();
  if (remarks) {
    payload.Comments = remarks;
  }

  if (requesterSapCode) {
    payload.Requester = normalizeSapRequesterValue(requesterSapCode);
  }

  return payload;
}
