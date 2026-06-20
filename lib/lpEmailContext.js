import { formatMoneyWithCurrency } from '@/lib/lpMoney.js';
import { getApprovalHistory } from '@/lib/auditHistory.js';
import { buildDocumentUrl, getAppBaseUrl } from '@/lib/emailTemplates.js';

function sumLineTotals(lines = []) {
  return lines.reduce((sum, line) => {
    const t = line.lineTotal;
    if (t != null && Number.isFinite(Number(t))) return sum + Number(t);
    const qty = Number(line.quantity) || 0;
    const price = Number(line.unitPrice) || 0;
    return sum + qty * price;
  }, 0);
}

function formatLpDate(value) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export function buildLpEmailContext(lp, extras = {}) {
  if (!lp) return { ...extras };
  const currency = lp.currency || 'IQD';
  const total = Number(lp.documentTotal) || sumLineTotals(lp.lines);
  const docId = lp._id?.toString?.() || lp.id;
  const base = getAppBaseUrl();
  const pathApprove = `/local-purchases/${docId}/approve`;
  const pathEdit = `/local-purchases/${docId}/edit`;
  const pathView = `/local-purchases/${docId}`;

  return {
    portalLPNumber: lp.portalLPNumber,
    documentId: docId,
    creatorName: lp.createdBy?.name || lp.createdByName,
    creatorEmail: lp.createdBy?.email,
    requesterEmail: lp.createdBy?.email,
    requestDate: lp.documentDate
      ? new Date(lp.documentDate).toLocaleDateString('en-CA')
      : undefined,
    currency,
    budgetFormatted:
      lp.budget != null ? formatMoneyWithCurrency(lp.budget, currency) : undefined,
    documentTotalFormatted: total > 0 ? formatMoneyWithCurrency(total, currency) : undefined,
    lineCount: Array.isArray(lp.lines) ? lp.lines.length : undefined,
    remarks: lp.remarks,
    status: lp.status,
    documentTypeLabel: 'Local Purchase',
    documentUrl: buildDocumentUrl('LOCAL_PURCHASE', docId),
    approveUrl: base ? `${base}${pathApprove}` : pathApprove,
    editUrl: base ? `${base}${pathEdit}` : pathEdit,
    viewUrl: base ? `${base}${pathView}` : pathView,
    completedAtFormatted: formatLpDate(lp.completedAt),
    rejectedAtFormatted: formatLpDate(lp.rejectedAt),
    resubmittedAtFormatted: formatLpDate(lp.submittedAt),
    previousRejectionReason: lp.rejectionReason,
    rejectionReason: lp.rejectionReason,
    ...extras,
  };
}

export async function enrichLpEmailContextFromHistory(documentId, context = {}) {
  const history = await getApprovalHistory('LOCAL_PURCHASE', documentId);
  const pmEntry = history.find(
    (entry) => entry.requiredPermission === 'lp.approve.pm' && entry.action === 'Approved',
  );
  const financeEntry = history.find(
    (entry) => entry.requiredPermission === 'lp.approve.finance' && entry.action === 'Approved',
  );
  return {
    ...context,
    pmApproverName: pmEntry?.actionBy?.name || context.pmApproverName,
    financeApproverName: financeEntry?.actionBy?.name || context.financeApproverName,
  };
}
