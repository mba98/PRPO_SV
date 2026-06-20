/**
 * Build template context objects for workflow emails from portal documents.
 */

import { buildLpEmailContext as buildLpEmailContextImpl } from '@/lib/lpEmailContext.js';

function sumLineTotals(lines = []) {
  return lines.reduce((sum, line) => {
    const t = line.lineTotal ?? line.estimatedTotal;
    if (t != null && Number.isFinite(Number(t))) return sum + Number(t);
    const qty = Number(line.quantity) || 0;
    const price = Number(line.unitPrice ?? line.estimatedUnitPrice) || 0;
    return sum + qty * price;
  }, 0);
}

export function buildPrEmailContext(pr) {
  if (!pr) return {};
  const total = sumLineTotals(pr.lines);
  return {
    portalPRNumber: pr.portalPRNumber,
    documentId: pr._id?.toString?.() || pr.id,
    requesterName: pr.requester?.name || pr.requesterName,
    requesterEmail: pr.requesterEmail || pr.requester?.email,
    department: pr.department,
    project: pr.project,
    status: pr.status,
    docNum: pr.sapPRDocNum,
    totalAmount: total > 0 ? total.toFixed(2) : undefined,
    documentTypeLabel: 'Purchase Request',
  };
}

export function buildPoEmailContext(po, extras = {}) {
  if (!po) return { ...extras };
  const total = sumLineTotals(po.lines);
  return {
    portalPONumber: po.portalPONumber,
    documentId: po._id?.toString?.() || po.id,
    requesterName: po.requester?.name || po.requesterName,
    requesterEmail: po.requesterEmail || po.requester?.email,
    department: po.department,
    project: po.project,
    vendor: po.vendor,
    status: po.status,
    docNum: po.sapPODocNum,
    totalAmount: total > 0 ? total.toFixed(2) : undefined,
    relatedPRNumber: po.relatedPRNumber || extras.relatedPRNumber,
    documentTypeLabel: 'Purchase Order',
    ...extras,
  };
}

export function buildApriEmailContext(apri) {
  if (!apri) return {};
  const total = sumLineTotals(apri.lines);
  return {
    portalAPNumber: apri.portalAPNumber,
    documentId: apri._id?.toString?.() || apri.id,
    vendor: apri.vendor,
    status: apri.status,
    docNum: apri.sapAPDocNum,
    totalAmount: total > 0 ? total.toFixed(2) : undefined,
    relatedPONumber: apri.relatedPONumber,
    documentTypeLabel: 'A/P Reserve Invoice',
  };
}

export function buildLpEmailContext(lp, extras = {}) {
  return buildLpEmailContextImpl(lp, extras);
}
