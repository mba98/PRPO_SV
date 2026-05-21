import { toSapDate } from '@/lib/dateUtils.js';

export const SAP_PO_BASE_TYPE = 22;

/**
 * Resolve SAP PO line number from PO Service Layer response.
 */
export function resolvePoSapLineNum(po, line, lineIndex) {
  const sapLines = po?.sapResponse?.DocumentLines;
  if (!Array.isArray(sapLines)) return null;
  const match = sapLines.find((sl) => sl.ItemCode === line.itemCode);
  if (match?.LineNum != null) return match.LineNum;
  if (sapLines[lineIndex]?.LineNum != null) return sapLines[lineIndex].LineNum;
  return null;
}

/**
 * Build APRI lines with required PO base references.
 */
export function buildApriLinesFromPo(po) {
  const lines = [];
  (po.lines || []).forEach((line, idx) => {
    const relatedPOLineNum = resolvePoSapLineNum(po, line, idx);
    if (relatedPOLineNum == null) return;
    lines.push({
      relatedPOLineId: line._id,
      relatedPOLineNum,
      itemCode: line.itemCode,
      itemName: line.itemName,
      quantity: line.quantity,
      uom: line.uom,
      warehouseCode: line.warehouseCode || po.warehouse,
      projectCode: line.projectCode || po.project,
      costCenter: line.costCenter,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal,
      remarks: line.remarks,
    });
  });
  return lines;
}

/**
 * MongoDB APReserveInvoice → SAP Service Layer /PurchaseInvoices (reserve).
 */
export function mapApReserveInvoiceToSap(apri, options = {}) {
  const baseEntry = apri.relatedSAPPODocEntry;
  if (baseEntry == null) {
    throw new Error('Related SAP PO DocEntry is required');
  }

  const documentLines = (apri.lines || []).map((line) => {
    if (line.relatedPOLineNum == null) {
      throw new Error(`Line ${line.itemCode || ''} is missing valid PO base reference`);
    }
    return {
      BaseType: SAP_PO_BASE_TYPE,
      BaseEntry: baseEntry,
      BaseLine: line.relatedPOLineNum,
      ItemCode: line.itemCode,
      Quantity: line.quantity,
      WarehouseCode: line.warehouseCode,
      ProjectCode: line.projectCode,
      CostingCode: line.costCenter,
    };
  });

  if (!documentLines.length) {
    throw new Error('At least one line with valid PO base reference is required');
  }

  return {
    CardCode: apri.vendor,
    DocDate: toSapDate(apri.documentDate),
    DocDueDate: toSapDate(apri.dueDate || apri.documentDate),
    ReserveInvoice: 'tYES',
    Comments: apri.remarks || '',
    DocumentLines: documentLines,
    ...(options.docCurrency ? { DocCurrency: options.docCurrency } : {}),
  };
}
