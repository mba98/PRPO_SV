import { toSapDate } from '@/lib/dateUtils.js';
import { resolveBranchId } from '@/lib/sap/mappers/prToSap.js';

export const SAP_PR_BASE_TYPE = parseInt(process.env.SAP_PR_BASE_TYPE || '1470000113', 10);

/**
 * Resolve SAP PR line number for PO base document line reference.
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
  return (pr.lines || []).filter((line, idx) => {
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

/**
 * Build SAP /PurchaseOrders payload from PR + vendor subset, referencing SAP PR.
 */
export function mapPoFromPrToSap(pr, { vendor, lines, branchMap = {} }) {
  const docLines = (lines || linesForVendor(pr, vendor)).map((line, idx) => {
    const remaining = (line.quantity || 0) - (line.orderedQty || 0);
    const prLineIndex = (pr.lines || []).findIndex((l) => l._id?.toString() === line._id?.toString());
    const baseLine = resolvePrBaseLineNum(pr, line, prLineIndex >= 0 ? prLineIndex : idx);
    return {
      BaseType: SAP_PR_BASE_TYPE,
      BaseEntry: pr.sapPRDocEntry,
      BaseLine: baseLine,
      ItemCode: line.itemCode,
      Quantity: remaining,
      UnitPrice: line.estimatedUnitPrice,
      WarehouseCode: line.warehouseCode || pr.warehouse,
      ProjectCode: line.projectCode || pr.project,
      CostingCode: line.costCenter,
      U_Department: line.uDepartment,
      U_DelDate: toSapDate(line.uDelDate),
      U_Rate: line.uRate,
    };
  });

  return {
    CardCode: vendor,
    DocDate: toSapDate(pr.documentDate || pr.requiredDate),
    DocDueDate: toSapDate(pr.requiredDate),
    Comments: `Portal PR ${pr.portalPRNumber}${pr.sapPRDocNum ? ` (SAP ${pr.sapPRDocNum})` : ''}`,
    BPL_IDAssignedToInvoice: resolveBranchId(pr.department, branchMap),
    DocumentLines: docLines,
  };
}

/**
 * MongoDB PurchaseOrder → SAP Service Layer /PurchaseOrders payload.
 */
export function mapPoToSap(po, options = {}) {
  const branchMap = options.branchMap || {};
  const payload = {
    CardCode: po.vendor,
    DocDate: toSapDate(po.documentDate || po.requiredDate),
    DocDueDate: toSapDate(po.requiredDate),
    Comments: po.remarks || '',
    BPL_IDAssignedToInvoice: resolveBranchId(po.department, branchMap),
    DocumentLines: (po.lines || []).map((line) => ({
      ItemCode: line.itemCode,
      Quantity: line.quantity,
      UnitPrice: line.unitPrice,
      WarehouseCode: line.warehouseCode || po.warehouse,
      ProjectCode: line.projectCode || po.project,
      CostingCode: line.costCenter,
      U_Department: line.uDepartment,
      U_DelDate: toSapDate(line.uDelDate),
      U_Rate: line.uRate,
    })),
  };

  if (po.relatedSAPPRDocEntry != null) {
    payload.DocumentLines = payload.DocumentLines.map((dl, idx) => {
      const src = po.lines[idx];
      if (src?.sapPRBaseLine != null) {
        return {
          ...dl,
          BaseType: SAP_PR_BASE_TYPE,
          BaseEntry: po.relatedSAPPRDocEntry,
          BaseLine: src.sapPRBaseLine,
        };
      }
      return dl;
    });
  }

  return payload;
}
