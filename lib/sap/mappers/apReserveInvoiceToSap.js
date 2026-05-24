import { toSapDate } from '@/lib/dateUtils.js';
import {
  resolveDefaultPoDocCurrency,
  resolveDefaultPoDocRate,
} from '@/lib/sap/sapPoConfig.js';

export const SAP_PO_BASE_TYPE = 22;

const DEFAULT_DOC_CURRENCY_FALLBACK = 'USD';
const DEFAULT_DOC_RATE_FALLBACK = 1350;

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
 * Item / warehouse / price are kept for portal display only — SAP receives
 * only Base* + Quantity (see mapApReserveInvoiceToSap).
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

function resolveDocCurrency(apri, options) {
  const candidate =
    apri.docCurrency ||
    options.docCurrency ||
    resolveDefaultPoDocCurrency() ||
    DEFAULT_DOC_CURRENCY_FALLBACK;
  return String(candidate).trim();
}

function resolveDocRate(apri, options) {
  const raw =
    apri.docRate ??
    options.docRate ??
    resolveDefaultPoDocRate() ??
    DEFAULT_DOC_RATE_FALLBACK;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function resolveComments(apri) {
  const remarks = apri.remarks?.trim();
  if (remarks) return remarks;
  const ref = apri.relatedSAPPODocNum || apri.relatedPONumber;
  return ref ? `AP Reserve Invoice based on PO ${ref}` : 'AP Reserve Invoice';
}

/**
 * MongoDB APReserveInvoice → SAP Service Layer /PurchaseInvoices (reserve).
 *
 * Postman-confirmed payload shape:
 *   { CardCode, DocDate, DocDueDate, TaxDate, DocCurrency, DocRate,
 *     ReserveInvoice: "tYES", Comments,
 *     DocumentLines: [{ BaseType: 22, BaseEntry, BaseLine, Quantity }] }
 *
 * ItemCode / WarehouseCode / UoMCode / Currency / Rate are deliberately
 * omitted on lines — SAP copies them from the referenced PO line and any
 * mismatch triggers exchange-rate or pricing errors.
 */
export function mapApReserveInvoiceToSap(apri, options = {}) {
  const baseEntry = apri.relatedSAPPODocEntry;
  if (baseEntry == null) {
    throw new Error('Related SAP PO DocEntry is required');
  }

  const documentLines = (apri.lines || []).map((line) => {
    if (line.relatedPOLineNum == null) {
      throw new Error(
        `Line ${line.itemCode || ''} is missing valid PO base reference`,
      );
    }
    return {
      BaseType: SAP_PO_BASE_TYPE,
      BaseEntry: baseEntry,
      BaseLine: line.relatedPOLineNum,
      Quantity: Number(line.quantity),
    };
  });

  if (!documentLines.length) {
    throw new Error('At least one line with valid PO base reference is required');
  }

  const docDate = toSapDate(apri.documentDate || apri.postingDate);
  const docDueDate = toSapDate(
    apri.dueDate || apri.documentDate || apri.postingDate,
  );
  const taxDate = toSapDate(
    apri.taxDate || apri.documentDate || apri.postingDate,
  );

  const payload = {
    CardCode: apri.vendor,
    DocDate: docDate,
    DocDueDate: docDueDate,
    TaxDate: taxDate,
    DocCurrency: resolveDocCurrency(apri, options),
    ReserveInvoice: 'tYES',
    Comments: resolveComments(apri),
    DocumentLines: documentLines,
  };

  const docRate = resolveDocRate(apri, options);
  if (docRate != null) {
    payload.DocRate = docRate;
  }

  return payload;
}
