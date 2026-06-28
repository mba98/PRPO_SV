import { linesForVendor } from '@/lib/sap/mappers/poToSap.js';
import { resolveLineWarehouseCode } from '@/lib/sap/sapWarehouseConfig.js';
import { resolveLineUomCode } from '@/lib/sap/uomCode.js';
import {
  applyVendorCurrencyToHeader,
  resolveFormDocRateFromPo,
} from '@/lib/poCurrency.js';
import { toPoDateInput, recalcPoLineTotal } from '@/lib/poFormUtils.js';

function mapPrLineToDraftLine(pr, line, prLineIndex) {
  const qty = (line.quantity || 0) - (line.orderedQty || 0);
  const unitPrice = line.estimatedUnitPrice ?? '';
  const draftLine = {
    relatedPRLineId: line._id?.toString?.() || line._id || undefined,
    itemCode: line.itemCode || '',
    itemName: line.itemName || '',
    quantity: qty > 0 ? qty : '',
    unitPrice,
    uomCode: resolveLineUomCode(line) || line.uom || '',
    warehouseCode: resolveLineWarehouseCode(line, pr) || line.warehouseCode || '',
    warehouseLabel: resolveLineWarehouseCode(line, pr) || line.warehouseCode || '',
    remarks: line.remarks || '',
  };
  draftLine.lineTotal = recalcPoLineTotal(draftLine);
  return draftLine;
}

/**
 * Build an unsaved PO draft from a SAP-created PR and selected vendor.
 */
export function buildPoDraftFromPr(pr, vendorCode, vendorRow = null) {
  const prObj = typeof pr.toObject === 'function' ? pr.toObject() : pr;
  const vendor = (vendorCode || '').trim();
  const headerDate =
    prObj.documentDate || prObj.postingDate || prObj.requiredDate || prObj.dueDate || new Date();
  const requiredDate = prObj.requiredDate || prObj.dueDate || headerDate;
  const remarksBase = prObj.remarks?.trim()
    ? `From PR ${prObj.portalPRNumber}: ${prObj.remarks.trim()}`
    : `From PR ${prObj.portalPRNumber}`;

  const currencyDefaults = vendorRow
    ? applyVendorCurrencyToHeader(vendorRow, { docCurrency: 'USD', docRate: resolveFormDocRateFromPo({}) })
    : { docCurrency: 'USD', docRate: resolveFormDocRateFromPo({}) };

  const eligibleLines = linesForVendor(prObj, vendor);

  return {
    vendor,
    vendorLabel: vendorRow?.label || vendor,
    postingDate: toPoDateInput(prObj.postingDate || headerDate),
    documentDate: toPoDateInput(prObj.documentDate || headerDate),
    requiredDate: toPoDateInput(requiredDate),
    dueDate: toPoDateInput(prObj.dueDate || requiredDate),
    docCurrency: currencyDefaults.docCurrency,
    docRate: currencyDefaults.docRate,
    remarks: remarksBase,
    lines: eligibleLines.map((line, index) => {
      const prLineIndex = prObj.lines.findIndex(
        (l) => l._id?.toString?.() === line._id?.toString?.(),
      );
      return mapPrLineToDraftLine(prObj, line, prLineIndex >= 0 ? prLineIndex : index);
    }),
  };
}
