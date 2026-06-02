import { toSapDate } from '@/lib/dateUtils.js';
import { isInvalidSapOptionalCode } from '@/lib/sap/mappers/prToSap.js';
import { resolveLineUomCode } from '@/lib/sap/uomCode.js';
import { resolveLineWarehouseCode } from '@/lib/sap/sapWarehouseConfig.js';
import {
  isUsdPoCurrency,
  normalizePoDocCurrency,
  normalizePoDocRateForStorage,
} from '@/lib/poCurrency.js';
import {
  resolveDefaultPoDocCurrency,
  resolveDefaultPoDocRate,
  shouldSendPrUdfFields,
} from '@/lib/sap/sapPoConfig.js';

/** @deprecated Standalone PO flow no longer uses PR base documents. */
export const SAP_PR_BASE_TYPE = parseInt(process.env.SAP_PR_BASE_TYPE || '1470000113', 10);

/**
 * Resolve SAP PR line number (portal traceability only; not sent to SAP PO).
 */
export function resolvePrBaseLineNum(pr, line, lineIndex) {
  const sapLines = pr.sapResponse?.DocumentLines;
  if (!Array.isArray(sapLines)) return lineIndex;
  const match = sapLines.find((sl) => sl.ItemCode === line.itemCode);
  if (match?.LineNum != null) return match.LineNum;
  if (sapLines[lineIndex]?.LineNum != null) return sapLines[lineIndex].LineNum;
  return lineIndex;
}

/**
 * Lines eligible for PO for a given vendor (remaining quantity > 0).
 */
export function linesForVendor(pr, vendor) {
  return (pr.lines || []).filter((line) => {
    const remaining = (line.quantity || 0) - (line.orderedQty || 0);
    if (remaining <= 0) return false;
    const lineVendor = (line.vendor || '').trim();
    if (!lineVendor) return true;
    return lineVendor === vendor;
  });
}

/**
 * Distinct vendor codes suggested on PR lines.
 */
export function vendorsFromPrLines(pr) {
  const vendors = new Set();
  for (const line of pr.lines || []) {
    const v = (line.vendor || '').trim();
    if (v) vendors.add(v);
  }
  return [...vendors];
}

export function buildPoTraceComments(po) {
  const parts = [];
  if (po.remarks?.trim()) {
    parts.push(po.remarks.trim());
  }
  const traceParts = [
    po.relatedPRNumber ? `Portal PR ${po.relatedPRNumber}` : null,
    po.relatedSAPPRDocEntry != null ? `SAP PR DocEntry ${po.relatedSAPPRDocEntry}` : null,
    po.relatedSAPPRDocNum ? `SAP PR DocNum ${po.relatedSAPPRDocNum}` : null,
  ].filter(Boolean);
  if (traceParts.length) {
    parts.push(`Created from ${traceParts.join(' / ')}`);
  }
  return parts.filter(Boolean).join(' | ');
}

function mapStandalonePoLine(line, po) {
  const quantity = Number(line.quantity);
  const unitPrice = Number(line.unitPrice);
  const docLine = {
    ItemCode: line.itemCode,
    Quantity: quantity,
    UnitPrice: unitPrice,
  };

  const warehouseCode = resolveLineWarehouseCode(line, po);
  if (warehouseCode && !isInvalidSapOptionalCode(warehouseCode)) {
    docLine.WarehouseCode = warehouseCode;
  }

  const uomCode = resolveLineUomCode(line);
  if (uomCode) {
    docLine.UoMCode = uomCode;
  }

  return docLine;
}

/**
 * Standalone SAP /PurchaseOrders payload (no BaseType / BaseEntry / BaseLine).
 */
export function buildStandaloneSapPoPayload(po, options = {}) {
  const docDate = toSapDate(po.documentDate || po.postingDate || po.requiredDate);
  const docDueDate = toSapDate(po.dueDate || po.requiredDate || po.documentDate);
  const docCurrency = normalizePoDocCurrency(
    po.docCurrency,
    resolveDefaultPoDocCurrency(),
  );

  const payload = {
    CardCode: po.vendor,
    DocDate: docDate,
    DocDueDate: docDueDate,
    TaxDate: docDate,
    DocCurrency: docCurrency,
    Comments: buildPoTraceComments(po),
    DocumentLines: (po.lines || []).map((line) => mapStandalonePoLine(line, po)),
  };

  if (isUsdPoCurrency(docCurrency)) {
    const storedRate = normalizePoDocRateForStorage(docCurrency, po.docRate);
    const docRate =
      storedRate ??
      (po.docRate != null && Number(po.docRate) > 0
        ? Number(po.docRate)
        : resolveDefaultPoDocRate());
    if (docRate != null && docRate > 0) {
      payload.DocRate = docRate;
    }
  }

  const sendUdf = options.sendPrUdf ?? shouldSendPrUdfFields();
  if (sendUdf && po.relatedSAPPRDocEntry != null) {
    payload.U_BasePRDocEntry = po.relatedSAPPRDocEntry;
    if (po.relatedSAPPRDocNum != null) {
      payload.U_BasePRDocNum = String(po.relatedSAPPRDocNum);
    }
    if (po.relatedPRNumber) {
      payload.U_PortalPRNumber = po.relatedPRNumber;
    }
  }

  return payload;
}

export function validateStandaloneSapPoPayload(payload) {
  const errors = [];
  if (!payload.CardCode?.trim()) {
    errors.push('Vendor (CardCode) is required');
  }
  if (!payload.DocumentLines?.length) {
    errors.push('At least one document line is required');
  }
  payload.DocumentLines?.forEach((line, index) => {
    const n = index + 1;
    if (!line.ItemCode?.trim()) {
      errors.push(`Line ${n}: ItemCode is required`);
    }
    if (!line.Quantity || Number(line.Quantity) <= 0) {
      errors.push(`Line ${n}: Quantity must be greater than zero`);
    }
  });
  return { ok: errors.length === 0, errors };
}

/**
 * Legacy name — builds standalone PO from PR line subset (portal PO flow uses mapPoToSapFromPortalRecord).
 */
export function mapPoFromPrToSap(pr, { vendor, lines } = {}) {
  const subset = (lines || linesForVendor(pr, vendor)).map((line) => {
    const remaining = (line.quantity || 0) - (line.orderedQty || 0);
    return {
      itemCode: line.itemCode,
      itemName: line.itemName,
      quantity: remaining,
      unitPrice: line.estimatedUnitPrice,
      warehouseCode: line.warehouseCode || pr.warehouse,
      uomCode: line.uomCode,
      uom: line.uom,
      vendor,
    };
  });

  return buildStandaloneSapPoPayload({
    vendor,
    documentDate: pr.documentDate,
    postingDate: pr.postingDate,
    requiredDate: pr.requiredDate,
    dueDate: pr.dueDate,
    relatedPRNumber: pr.portalPRNumber,
    relatedSAPPRDocEntry: pr.sapPRDocEntry,
    relatedSAPPRDocNum: pr.sapPRDocNum,
    remarks: pr.remarks,
    lines: subset,
  });
}

/**
 * Approved portal PO → standalone SAP /PurchaseOrders.
 */
export function mapPoToSapFromPortalRecord(po, _pr, options = {}) {
  return buildStandaloneSapPoPayload(po, options);
}

/**
 * MongoDB PurchaseOrder → standalone SAP /PurchaseOrders.
 */
export function mapPoToSap(po, options = {}) {
  return buildStandaloneSapPoPayload(po, options);
}
