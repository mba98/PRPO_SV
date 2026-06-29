import * as XLSX from 'xlsx';

function sumLineTotals(lines = []) {
  return lines.reduce((sum, line) => {
    const t = line.lineTotal ?? line.estimatedTotal;
    if (t != null && Number.isFinite(Number(t))) return sum + Number(t);
    const qty = Number(line.quantity) || 0;
    const price = Number(line.unitPrice ?? line.estimatedUnitPrice) || 0;
    return sum + qty * price;
  }, 0);
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

export function prRowsForExport(items) {
  return items.map((pr) => ({
    'Portal PR Number': pr.portalPRNumber,
    'SAP PR DocNum': pr.sapPRDocNum || '',
    Requester: pr.requesterName || '',
    Department: pr.department || '',
    Project: pr.project || '',
    Warehouse: pr.warehouse || '',
    Status: pr.status || '',
    'Required Date': formatDate(pr.requiredDate),
    'Created At': formatDateTime(pr.createdAt),
    'Total Amount': sumLineTotals(pr.lines),
    'Lines Count': (pr.lines || []).length,
  }));
}

export function poRowsForExport(items) {
  return items.map((po) => ({
    'Portal PO Number': po.portalPONumber,
    'Related PR Number': po.relatedPRNumber || '',
    'SAP PO DocNum': po.sapPODocNum || '',
    Vendor: po.vendor || '',
    Department: po.department || '',
    Project: po.project || '',
    Warehouse: po.warehouse || '',
    Status: po.status || '',
    'Document Date': formatDate(po.documentDate || po.postingDate),
    'Created At': formatDateTime(po.createdAt),
    'Total Amount': sumLineTotals(po.lines),
    'Lines Count': (po.lines || []).length,
  }));
}

export function apriRowsForExport(items, { includeFinancials = true } = {}) {
  return items.map((apri) => {
    const row = {
      'Portal AP Number': apri.portalAPNumber,
      'Related PO Number': apri.relatedPONumber || '',
      'SAP AP DocNum': apri.sapAPDocNum || '',
      Vendor: apri.vendor || '',
      Status: apri.status || '',
      'Document Date': formatDate(apri.documentDate || apri.postingDate),
      'Created At': formatDateTime(apri.createdAt),
      'Lines Count': (apri.lines || []).length,
    };
    if (includeFinancials) {
      row['Total Amount'] = sumLineTotals(apri.lines);
    }
    return row;
  });
}

export function buildWorkbookBuffer(rows, sheetName = 'Export') {
  const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

export function exportFilename(prefix) {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}-${stamp}.xlsx`;
}
