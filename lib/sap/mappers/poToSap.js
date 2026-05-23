import { toSapDate } from '@/lib/dateUtils.js';
import { resolveBranchId } from '@/lib/sap/sapBranchConfig.js';
import { isInvalidSapOptionalCode } from '@/lib/sap/mappers/prToSap.js';
import { resolveLineUomCode } from '@/lib/sap/uomCode.js';

function mapPoSapDocumentLine(line, po = {}) {
  const docLine = {
    ItemCode: line.itemCode,
    Quantity: line.quantity,
  };

  if (line.unitPrice != null && line.unitPrice !== '') {
    docLine.UnitPrice = line.unitPrice;
  }

  const warehouseCode = (line.warehouseCode || po.warehouse || '').trim();
  if (warehouseCode && !isInvalidSapOptionalCode(warehouseCode)) {
    docLine.WarehouseCode = warehouseCode;
  }

  const vendor = (line.vendor || po.vendor || '').trim();
  if (vendor && !isInvalidSapOptionalCode(vendor)) {
    docLine.LineVendor = vendor;
  }

  const uomCode = resolveLineUomCode(line);
  if (uomCode) {
    docLine.UoMCode = uomCode;
  }

  return docLine;
}

function applyPoHeaderOptionalFields(payload, po) {
  if (po.docRate != null && Number(po.docRate) > 0) {
    payload.DocRate = Number(po.docRate);
  }
  return payload;
}

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
    const mapped = mapPoSapDocumentLine(
      {
        ...line,
        quantity: remaining,
        unitPrice: line.estimatedUnitPrice,
        warehouseCode: line.warehouseCode || pr.warehouse,
      },
      pr,
    );
    return {
      ...mapped,
      BaseType: SAP_PR_BASE_TYPE,
      BaseEntry: pr.sapPRDocEntry,
      BaseLine: baseLine,
      ProjectCode: line.projectCode || pr.project,
      CostingCode: line.costCenter,
      U_Department: line.uDepartment,
      U_DelDate: toSapDate(line.uDelDate),
      U_Rate: line.uRate,
    };
  });

  return applyPoHeaderOptionalFields(
    {
      CardCode: vendor,
      DocDate: toSapDate(pr.documentDate || pr.requiredDate),
      DocDueDate: toSapDate(pr.requiredDate),
      Comments: `Portal PR ${pr.portalPRNumber}${pr.sapPRDocNum ? ` (SAP ${pr.sapPRDocNum})` : ''}`,
      BPL_IDAssignedToInvoice: resolveBranchId(pr.department, branchMap),
      DocumentLines: docLines,
    },
    pr,
  );
}

/**
 * Approved portal PO + related PR → SAP /PurchaseOrders with PR base document lines.
 */
export function mapPoToSapFromPortalRecord(po, pr, options = {}) {
  const branchMap = options.branchMap || {};
  const payload = applyPoHeaderOptionalFields(
    {
      CardCode: po.vendor,
      DocDate: toSapDate(po.documentDate || po.requiredDate),
      DocDueDate: toSapDate(po.requiredDate || po.dueDate),
      Comments: po.remarks || `Portal PO ${po.portalPONumber} from PR ${po.relatedPRNumber}`,
      BPL_IDAssignedToInvoice: resolveBranchId(po.department, branchMap),
      DocumentLines: (po.lines || []).map((line) => {
        const mapped = mapPoSapDocumentLine(line, po);
        return {
          ...mapped,
          BaseType: SAP_PR_BASE_TYPE,
          BaseEntry: po.relatedSAPPRDocEntry ?? pr?.sapPRDocEntry,
          BaseLine: line.sapPRBaseLine ?? 0,
          ProjectCode: line.projectCode || po.project,
          CostingCode: line.costCenter,
          U_Department: line.uDepartment,
          U_DelDate: toSapDate(line.uDelDate),
          U_Rate: line.uRate,
        };
      }),
    },
    po,
  );
  return payload;
}

/**
 * MongoDB PurchaseOrder → SAP Service Layer /PurchaseOrders payload.
 */
export function mapPoToSap(po, options = {}) {
  const branchMap = options.branchMap || {};
  const payload = applyPoHeaderOptionalFields(
    {
      CardCode: po.vendor,
      DocDate: toSapDate(po.documentDate || po.requiredDate),
      DocDueDate: toSapDate(po.requiredDate || po.dueDate),
      Comments: po.remarks || '',
      BPL_IDAssignedToInvoice: resolveBranchId(po.department, branchMap),
      DocumentLines: (po.lines || []).map((line) => mapPoSapDocumentLine(line, po)),
    },
    po,
  );

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
