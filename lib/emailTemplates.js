/**
 * Centralized HTML + plain-text email templates for workflow notifications.
 */

const FOOTER = 'SPC Procurement Portal';

const DOC_PATHS = {
  PR: (id) => `/purchase-requests/${id}`,
  PO: (id) => `/purchase-orders/${id}`,
  APRI: (id) => `/ap-reserve-invoices/${id}`,
  LOCAL_PURCHASE: (id) => `/local-purchases/${id}`,
};

const DOC_LABELS = {
  PR: 'Purchase Request',
  PO: 'Purchase Order',
  APRI: 'A/P Reserve Invoice',
  LOCAL_PURCHASE: 'Local Purchase',
};

const CTA_LABELS = {
  PR: 'Open Purchase Request',
  PO: 'Open Purchase Order',
  APRI: 'Open A/P Reserve Invoice',
  LOCAL_PURCHASE: 'Open Local Purchase',
};

export function getAppBaseUrl() {
  const base = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '';
  return String(base).replace(/\/$/, '');
}

export function buildDocumentUrl(documentType, documentId) {
  const builder = DOC_PATHS[documentType];
  const path = builder && documentId ? builder(documentId) : '/';
  const base = getAppBaseUrl();
  return base ? `${base}${path}` : path;
}

function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function greeting(recipientName) {
  if (recipientName) {
    return `Dear ${escapeHtml(recipientName)},`;
  }
  return 'Hello,';
}

function ctaButton(documentType, documentId, label) {
  const href = buildDocumentUrl(documentType, documentId);
  const text = label || CTA_LABELS[documentType] || 'Open document';
  return `<p style="margin:24px 0;"><a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">${escapeHtml(text)}</a></p>`;
}

function wrapHtml({ title, greetingLine, bodyHtml, documentType, documentId, ctaLabel, ctaHref }) {
  const actionHtml = ctaHref
    ? `<p style="margin:24px 0;"><a href="${escapeHtml(ctaHref)}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">${escapeHtml(ctaLabel || 'Open document')}</a></p>`
    : documentType && documentId
      ? ctaButton(documentType, documentId, ctaLabel)
      : '';
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;">
        <tr><td style="padding:28px 32px;">
          <p style="margin:0 0 16px;font-size:15px;color:#334155;">${greetingLine}</p>
          ${bodyHtml}
          ${actionHtml}
          <p style="margin:24px 0 0;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:16px;">${escapeHtml(FOOTER)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function detailRow(label, value) {
  if (value == null || value === '') return '';
  return `<tr><td style="padding:6px 12px 6px 0;color:#64748b;font-size:13px;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:6px 0;font-size:13px;font-weight:600;">${escapeHtml(value)}</td></tr>`;
}

function detailsTable(rows) {
  const inner = rows.filter(Boolean).join('');
  if (!inner) return '';
  return `<table cellpadding="0" cellspacing="0" style="margin:16px 0 8px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;">${inner}</table>`;
}

/** Shared document detail rows for workflow emails. */
export function buildCommonDetailRows(data = {}) {
  return [
    data.documentTypeLabel ? detailRow('Document type', data.documentTypeLabel) : '',
    data.portalPRNumber ? detailRow('PR number', data.portalPRNumber) : '',
    data.portalPONumber ? detailRow('PO number', data.portalPONumber) : '',
    data.portalAPNumber ? detailRow('APRI number', data.portalAPNumber) : '',
    data.portalLPNumber ? detailRow('Local Purchase', data.portalLPNumber) : '',
    data.status ? detailRow('Status', data.status) : '',
    data.requesterName ? detailRow('Requester', data.requesterName) : '',
    data.department ? detailRow('Department', data.department) : '',
    data.project ? detailRow('Project', data.project) : '',
    data.vendor ? detailRow('Vendor', data.vendor) : '',
    data.totalAmount ? detailRow('Total amount', data.totalAmount) : '',
    data.docNum ? detailRow('SAP DocNum', data.docNum) : '',
    data.relatedPRNumber ? detailRow('Related PR', data.relatedPRNumber) : '',
    data.relatedPONumber ? detailRow('Related PO', data.relatedPONumber) : '',
  ];
}

function lpDetailRows(data, extraRows = []) {
  return [
    detailRow('Local Purchase', data.portalLPNumber),
    data.requestDate ? detailRow('Request date', data.requestDate) : '',
    data.currency ? detailRow('Currency', data.currency) : '',
    data.budgetFormatted ? detailRow('Budget', data.budgetFormatted) : '',
    data.documentTotalFormatted ? detailRow('Document total', data.documentTotalFormatted) : '',
    data.lineCount != null ? detailRow('Lines', String(data.lineCount)) : '',
    data.remarks ? detailRow('Remarks', data.remarks) : '',
    data.creatorName ? detailRow('Created by', data.creatorName) : '',
    ...extraRows.filter(Boolean),
  ];
}

function lpArabicNote(text) {
  if (!text) return '';
  return `<p style="margin:12px 0 0;font-size:14px;color:#475569;direction:rtl;text-align:right;">${escapeHtml(text)}</p>`;
}

function workflowDetails(data, extraRows = []) {
  return detailsTable([...buildCommonDetailRows(data), ...extraRows.filter(Boolean)]);
}

/**
 * @param {string} templateKey
 * @param {object} data
 * @returns {{ subject: string, html: string, text: string }}
 */
export function buildWorkflowEmail(templateKey, data = {}) {
  const recipientName = data.recipientName || data.name || null;
  const greet = greeting(recipientName);
  const greetText = recipientName ? `Dear ${recipientName},` : 'Hello,';

  const prNum = data.portalPRNumber || data.prNumber;
  const poNum = data.portalPONumber || data.poNumber;
  const apNum = data.portalAPNumber || data.apNumber;
  const comment = data.comment ? String(data.comment).trim() : '';
  const docNum = data.docNum != null ? String(data.docNum) : '';
  const sapWarnings = data.sapWarnings ? String(data.sapWarnings).trim() : '';
  const relatedPr = data.relatedPRNumber || data.prPortalNumber;

  const builders = {
    'pr.created': () => {
      const docType = 'PR';
      const docId = data.documentId;
      const subject = `PR ${prNum} submitted for approval`;
      const status = 'Pending approval';
      const text = `${greetText}\n\nPurchase Request ${prNum} is pending your approval.\n\nDocument: ${prNum}\nStatus: ${status}\n\nOpen: ${buildDocumentUrl(docType, docId)}\n\n${FOOTER}`;
      const html = wrapHtml({
        title: subject,
        greetingLine: greet,
        documentType: docType,
        documentId: docId,
        ctaLabel: CTA_LABELS.PR,
        bodyHtml: `<p style="margin:0 0 12px;font-size:15px;">You have <strong>Purchase Request ${escapeHtml(prNum)}</strong> waiting for your approval.</p>
          ${detailsTable([
            detailRow('Document', prNum),
            detailRow('Type', DOC_LABELS.PR),
            detailRow('Status', status),
          ])}`,
      });
      return { subject, html, text };
    },

    'pr.whs.approved': () => {
      const docType = 'PR';
      const docId = data.documentId;
      const subject = `PR ${prNum} approved — pending PM`;
      const status = 'Pending Project Manager approval';
      const text = `${greetText}\n\nPurchase Request ${prNum} requires project manager approval.\n\nStatus: ${status}\n\nOpen: ${buildDocumentUrl(docType, docId)}\n\n${FOOTER}`;
      const html = wrapHtml({
        title: subject,
        greetingLine: greet,
        documentType: docType,
        documentId: docId,
        ctaLabel: CTA_LABELS.PR,
        bodyHtml: `<p style="margin:0 0 12px;font-size:15px;">Purchase Request <strong>${escapeHtml(prNum)}</strong> was approved at the warehouse step and now requires <strong>project manager approval</strong>.</p>
          ${detailsTable([
            detailRow('Document', prNum),
            detailRow('Status', status),
          ])}`,
      });
      return { subject, html, text };
    },

    'pr.pm.approved': () => {
      const docType = 'PR';
      const docId = data.documentId;
      const statusLine = data.status || 'Approved — SAP creation has started';
      const subject = `PR ${prNum} fully approved`;
      const text = `${greetText}\n\nPurchase Request ${prNum} was fully approved. ${statusLine}\n\nOpen: ${buildDocumentUrl(docType, docId)}\n\n${FOOTER}`;
      const html = wrapHtml({
        title: subject,
        greetingLine: greet,
        documentType: docType,
        documentId: docId,
        ctaLabel: CTA_LABELS.PR,
        bodyHtml: `<p style="margin:0 0 12px;font-size:15px;">Purchase Request <strong>${escapeHtml(prNum)}</strong> was fully approved. ${escapeHtml(statusLine)}.</p>
          ${workflowDetails(data)}`,
      });
      return { subject, html, text };
    },

    'pr.rejected': () => {
      const docType = 'PR';
      const docId = data.documentId;
      const rejectionReason = data.rejectionReason || comment;
      const rejectingStep = data.rejectingStep || data.rejectingStepName;
      const rejectingUser = data.rejectingUserName || data.approverName;
      const subject = `PR ${prNum} rejected`;
      const procurementNote =
        'The request has been returned to Procurement for correction and resubmission.';
      const procurementNoteAr =
        'تم إرجاع الطلب إلى المشتريات للتصحيح وإعادة الإرسال.';
      const text = `${greetText}\n\nPurchase Request ${prNum} was rejected.${rejectingStep ? `\nStep: ${rejectingStep}` : ''}${rejectingUser ? `\nRejected by: ${rejectingUser}` : ''}\nReason: ${rejectionReason || '—'}\n\n${procurementNote}\n\n${procurementNoteAr}\n\nOpen: ${buildDocumentUrl(docType, docId)}\n\n${FOOTER}`;
      const html = wrapHtml({
        title: subject,
        greetingLine: greet,
        documentType: docType,
        documentId: docId,
        ctaLabel: CTA_LABELS.PR,
        bodyHtml: `<p style="margin:0 0 12px;font-size:15px;">Purchase Request <strong>${escapeHtml(prNum)}</strong> was rejected${rejectingStep ? ` by <strong>${escapeHtml(rejectingStep)}</strong>` : ''}.</p>
          <p style="margin:0 0 12px;font-size:14px;color:#334155;">${escapeHtml(procurementNote)}</p>
          ${lpArabicNote(`تم رفض طلب الشراء ${prNum}${rejectingStep ? ` في خطوة ${rejectingStep}` : ''}.`)}
          ${lpArabicNote(`السبب: ${rejectionReason || '—'}`)}
          ${lpArabicNote(procurementNoteAr)}
          ${detailsTable([
            detailRow('Document', prNum),
            detailRow('Status', 'Rejected'),
            rejectingStep ? detailRow('Approval step', rejectingStep) : '',
            rejectingUser ? detailRow('Rejected by', rejectingUser) : '',
            detailRow('Reason', rejectionReason || '—'),
          ])}`,
      });
      return { subject, html, text };
    },

    'pr.sap.created': () => {
      const docType = 'PR';
      const docId = data.documentId;
      const subject = `PR ${prNum} created in SAP`;
      const text = `${greetText}\n\nPurchase Request ${prNum} was created in SAP (DocNum: ${docNum}).\n\nOpen: ${buildDocumentUrl(docType, docId)}\n\n${FOOTER}`;
      const html = wrapHtml({
        title: subject,
        greetingLine: greet,
        documentType: docType,
        documentId: docId,
        ctaLabel: CTA_LABELS.PR,
        bodyHtml: `<p style="margin:0 0 12px;font-size:15px;">Purchase Request <strong>${escapeHtml(prNum)}</strong> was successfully created in SAP.</p>
          ${detailsTable([
            detailRow('Document', prNum),
            detailRow('SAP DocNum', docNum),
            detailRow('Status', 'Created in SAP'),
          ])}`,
      });
      return { subject, html, text };
    },

    'pr.sap.failed': () => {
      const docType = 'PR';
      const docId = data.documentId;
      const sapError = data.sapErrorMessage ? String(data.sapErrorMessage).trim() : '';
      const status = data.status || 'Failed to Create in SAP';
      const subject = `PR ${prNum} SAP creation failed`;
      const text = `${greetText}\n\nPurchase Request ${prNum} failed to create in SAP.\nStatus: ${status}${sapError ? `\nSAP error: ${sapError}` : ''}\n\nAn authorized final-step approver can retry SAP creation from the document detail page.\n\nOpen: ${buildDocumentUrl(docType, docId)}\n\n${FOOTER}`;
      const html = wrapHtml({
        title: subject,
        greetingLine: greet,
        documentType: docType,
        documentId: docId,
        ctaLabel: CTA_LABELS.PR,
        bodyHtml: `<p style="margin:0 0 12px;font-size:15px;">Purchase Request <strong>${escapeHtml(prNum)}</strong> <strong style="color:#b91c1c;">failed to create in SAP</strong>. Please review the document in the portal.</p>
          ${detailsTable([
            detailRow('Document type', DOC_LABELS.PR),
            detailRow('Document', prNum),
            detailRow('Status', status),
            sapError ? detailRow('SAP error', sapError) : '',
          ])}
          <p style="margin:12px 0 0;font-size:14px;color:#475569;">An authorized final-step approver can retry SAP creation from the document detail page.</p>`,
      });
      return { subject, html, text };
    },

    'po.created': () => {
      const docType = 'PO';
      const docId = data.documentId;
      const subject = `PO ${poNum} pending approval`;
      const text = `${greetText}\n\nPurchase Order ${poNum}${relatedPr ? ` from PR ${relatedPr}` : ''} requires project manager approval.\n\nOpen: ${buildDocumentUrl(docType, docId)}\n\n${FOOTER}`;
      const html = wrapHtml({
        title: subject,
        greetingLine: greet,
        documentType: docType,
        documentId: docId,
        ctaLabel: CTA_LABELS.PO,
        bodyHtml: `<p style="margin:0 0 12px;font-size:15px;">You have <strong>Purchase Order ${escapeHtml(poNum)}</strong> waiting for <strong>project manager approval</strong>.</p>
          ${detailsTable([
            detailRow('Document', poNum),
            detailRow('Related PR', relatedPr),
            detailRow('Status', 'Pending Project Manager Approval'),
          ])}`,
      });
      return { subject, html, text };
    },

    'po.pm.approved': () => {
      const docType = 'PO';
      const docId = data.documentId;
      const subject = `PO ${poNum} approved — pending Finance`;
      const text = `${greetText}\n\nPurchase Order ${poNum} requires finance approval.\n\nOpen: ${buildDocumentUrl(docType, docId)}\n\n${FOOTER}`;
      const html = wrapHtml({
        title: subject,
        greetingLine: greet,
        documentType: docType,
        documentId: docId,
        ctaLabel: CTA_LABELS.PO,
        bodyHtml: `<p style="margin:0 0 12px;font-size:15px;">Purchase Order <strong>${escapeHtml(poNum)}</strong> was approved by the project manager and now requires <strong>finance approval</strong>.</p>
          ${detailsTable([
            detailRow('Document', poNum),
            detailRow('Status', 'Pending Finance Approval'),
          ])}`,
      });
      return { subject, html, text };
    },

    'po.finance.approved': () => {
      const docType = 'PO';
      const docId = data.documentId;
      const statusLine = data.status || 'Approved — SAP creation has started';
      const subject = `PO ${poNum} fully approved`;
      const text = `${greetText}\n\nPurchase Order ${poNum} was fully approved. ${statusLine}\n\nOpen: ${buildDocumentUrl(docType, docId)}\n\n${FOOTER}`;
      const html = wrapHtml({
        title: subject,
        greetingLine: greet,
        documentType: docType,
        documentId: docId,
        ctaLabel: CTA_LABELS.PO,
        bodyHtml: `<p style="margin:0 0 12px;font-size:15px;">Purchase Order <strong>${escapeHtml(poNum)}</strong> was <strong>fully approved</strong>. ${escapeHtml(statusLine)}.</p>
          ${detailsTable([
            detailRow('Document', poNum),
            detailRow('Status', statusLine),
          ])}`,
      });
      return { subject, html, text };
    },

    'po.rejected': () => {
      const docType = 'PO';
      const docId = data.documentId;
      const subject = `PO ${poNum} rejected`;
      const text = `${greetText}\n\nPurchase Order ${poNum} was rejected.${comment ? `\nComment: ${comment}` : ''}\n\nOpen: ${buildDocumentUrl(docType, docId)}\n\n${FOOTER}`;
      const html = wrapHtml({
        title: subject,
        greetingLine: greet,
        documentType: docType,
        documentId: docId,
        ctaLabel: CTA_LABELS.PO,
        bodyHtml: `<p style="margin:0 0 12px;font-size:15px;">Purchase Order <strong>${escapeHtml(poNum)}</strong> was <strong style="color:#b91c1c;">rejected</strong>.</p>
          ${detailsTable([
            detailRow('Document', poNum),
            detailRow('Status', 'Rejected'),
            comment ? detailRow('Comment', comment) : '',
          ])}`,
      });
      return { subject, html, text };
    },

    'po.sap.created': () => {
      const docType = 'PO';
      const docId = data.documentId;
      const subject = `PO ${poNum} created in SAP`;
      const text = `${greetText}\n\nPurchase Order ${poNum} was created in SAP (DocNum: ${docNum}).${sapWarnings ? `\nNote: ${sapWarnings}` : ''}\n\nOpen: ${buildDocumentUrl(docType, docId)}\n\n${FOOTER}`;
      const html = wrapHtml({
        title: subject,
        greetingLine: greet,
        documentType: docType,
        documentId: docId,
        ctaLabel: CTA_LABELS.PO,
        bodyHtml: `<p style="margin:0 0 12px;font-size:15px;">Purchase Order <strong>${escapeHtml(poNum)}</strong> was successfully created in SAP.</p>
          ${detailsTable([
            detailRow('Document', poNum),
            detailRow('SAP DocNum', docNum),
            detailRow('Status', 'Created in SAP'),
            sapWarnings ? detailRow('Note', sapWarnings) : '',
          ])}`,
      });
      return { subject, html, text };
    },

    'po.sap.failed': () => {
      const docType = 'PO';
      const docId = data.documentId;
      const sapError = data.sapErrorMessage ? String(data.sapErrorMessage).trim() : '';
      const status = data.status || 'Failed to Create in SAP';
      const subject = `PO ${poNum} SAP creation failed`;
      const text = `${greetText}\n\nPurchase Order ${poNum} failed to create in SAP.\nStatus: ${status}${sapError ? `\nSAP error: ${sapError}` : ''}\n\nAn authorized final-step approver can retry SAP creation from the document detail page.\n\nOpen: ${buildDocumentUrl(docType, docId)}\n\n${FOOTER}`;
      const html = wrapHtml({
        title: subject,
        greetingLine: greet,
        documentType: docType,
        documentId: docId,
        ctaLabel: CTA_LABELS.PO,
        bodyHtml: `<p style="margin:0 0 12px;font-size:15px;">Purchase Order <strong>${escapeHtml(poNum)}</strong> <strong style="color:#b91c1c;">failed to create in SAP</strong>.</p>
          ${detailsTable([
            detailRow('Document type', DOC_LABELS.PO),
            detailRow('Document', poNum),
            detailRow('Status', status),
            sapError ? detailRow('SAP error', sapError) : '',
          ])}
          <p style="margin:12px 0 0;font-size:14px;color:#475569;">An authorized final-step approver can retry SAP creation from the document detail page.</p>`,
      });
      return { subject, html, text };
    },

    'apri.warehouse.approved': () => {
      const docType = 'APRI';
      const docId = data.documentId;
      const subject = `AP Reserve Invoice ${apNum} approved by Warehouse`;
      const text = `${greetText}\n\nWarehouse approved the A/P Reserve Invoice request ${apNum}. It is now ready for creation in SAP.\n\nOpen: ${buildDocumentUrl(docType, docId)}\n\n${FOOTER}`;
      const html = wrapHtml({
        title: subject,
        greetingLine: greet,
        documentType: docType,
        documentId: docId,
        ctaLabel: CTA_LABELS.APRI,
        bodyHtml: `<p style="margin:0 0 12px;font-size:15px;">Warehouse approved the A/P Reserve Invoice request <strong>${escapeHtml(apNum)}</strong>. It is now ready for creation in SAP.</p>
          ${detailsTable([
            detailRow('Document', apNum),
            detailRow('Status', 'Warehouse Approved'),
          ])}`,
      });
      return { subject, html, text };
    },

    'apri.resubmitted': () => {
      const docType = 'APRI';
      const docId = data.documentId;
      const subject = `AP Reserve Invoice ${apNum} resubmitted for approval`;
      const text = `${greetText}\n\nA/P Reserve Invoice ${apNum} was resubmitted by Procurement after quantity correction. It is pending Warehouse approval.\n\nOpen: ${buildDocumentUrl(docType, docId)}\n\n${FOOTER}`;
      const html = wrapHtml({
        title: subject,
        greetingLine: greet,
        documentType: docType,
        documentId: docId,
        ctaLabel: CTA_LABELS.APRI,
        bodyHtml: `<p style="margin:0 0 12px;font-size:15px;">A/P Reserve Invoice <strong>${escapeHtml(apNum)}</strong> was resubmitted by Procurement after quantity correction. It is pending Warehouse approval.</p>
          ${lpArabicNote(`تمت إعادة إرسال فاتورة A/P الاحتياطية ${apNum} من قبل المشتريات بعد تصحيح الكمية.`)}
          ${detailsTable([
            detailRow('Document', apNum),
            detailRow('Status', data.status || 'Pending Warehouse Approval'),
          ])}`,
      });
      return { subject, html, text };
    },

    'apri.warehouse.rejected': () => {
      const docType = 'APRI';
      const docId = data.documentId;
      const comment = data.comment ? escapeHtml(String(data.comment)) : '—';
      const subject = `AP Reserve Invoice ${apNum} rejected by Warehouse`;
      const text = `${greetText}\n\nWarehouse rejected the A/P Reserve Invoice request ${apNum}. Review the rejection reason, adjust the quantity, and create the document in SAP.\n\nReason: ${data.comment || '—'}\n\nOpen: ${buildDocumentUrl(docType, docId)}\n\n${FOOTER}`;
      const html = wrapHtml({
        title: subject,
        greetingLine: greet,
        documentType: docType,
        documentId: docId,
        ctaLabel: CTA_LABELS.APRI,
        bodyHtml: `<p style="margin:0 0 12px;font-size:15px;">Warehouse rejected the A/P Reserve Invoice request <strong>${escapeHtml(apNum)}</strong>. Review the rejection reason, adjust the quantity, and create the document in SAP.</p>
          ${detailsTable([
            detailRow('Document', apNum),
            detailRow('Rejection reason', comment),
            detailRow('Status', 'Warehouse Rejected'),
          ])}`,
      });
      return { subject, html, text };
    },

    'apri.sap.created': () => {
      const docType = 'APRI';
      const docId = data.documentId;
      const subject = `AP Reserve Invoice ${apNum} created in SAP`;
      const text = `${greetText}\n\nA/P Reserve Invoice ${apNum} was created in SAP (DocNum: ${docNum}).\n\nOpen: ${buildDocumentUrl(docType, docId)}\n\n${FOOTER}`;
      const html = wrapHtml({
        title: subject,
        greetingLine: greet,
        documentType: docType,
        documentId: docId,
        ctaLabel: CTA_LABELS.APRI,
        bodyHtml: `<p style="margin:0 0 12px;font-size:15px;">A/P Reserve Invoice <strong>${escapeHtml(apNum)}</strong> was successfully created in SAP.</p>
          ${detailsTable([
            detailRow('Document', apNum),
            detailRow('SAP DocNum', docNum),
            detailRow('Status', 'Created in SAP'),
          ])}`,
      });
      return { subject, html, text };
    },

    'apri.sap.failed': () => {
      const docType = 'APRI';
      const docId = data.documentId;
      const subject = `AP Reserve Invoice ${apNum} SAP creation failed`;
      const text = `${greetText}\n\nA/P Reserve Invoice ${apNum} failed to create in SAP.\n\nOpen: ${buildDocumentUrl(docType, docId)}\n\n${FOOTER}`;
      const html = wrapHtml({
        title: subject,
        greetingLine: greet,
        documentType: docType,
        documentId: docId,
        ctaLabel: CTA_LABELS.APRI,
        bodyHtml: `<p style="margin:0 0 12px;font-size:15px;">A/P Reserve Invoice <strong>${escapeHtml(apNum)}</strong> <strong style="color:#b91c1c;">failed to create in SAP</strong>.</p>
          ${detailsTable([
            detailRow('Document', apNum),
            detailRow('Status', 'Failed to Create in SAP'),
          ])}`,
      });
      return { subject, html, text };
    },

    'local_purchase.pending_pm': () => {
      const docType = 'LOCAL_PURCHASE';
      const docId = data.documentId;
      const lpNum = data.portalLPNumber;
      const approveHref = data.approveUrl || `${getAppBaseUrl()}/local-purchases/${docId}/approve`;
      const subject = `Local Purchase ${lpNum} requires Project Manager approval`;
      const text = `${greetText}\n\nLocal Purchase ${lpNum} is pending Project Manager approval.\n\nOpen: ${approveHref}\n\n${FOOTER}`;
      const html = wrapHtml({
        title: subject,
        greetingLine: greet,
        ctaHref: approveHref,
        ctaLabel: 'Review & Approve',
        bodyHtml: `<p style="margin:0 0 12px;font-size:15px;">Local Purchase <strong>${escapeHtml(lpNum)}</strong> requires your <strong>Project Manager approval</strong>.</p>
          ${lpArabicNote(`طلب المشتريات المحلية ${lpNum} بانتظار موافقة مدير المشروع`)}
          ${detailsTable(lpDetailRows(data))}`,
      });
      return { subject, html, text };
    },

    'local_purchase.pending_finance': () => {
      const docId = data.documentId;
      const lpNum = data.portalLPNumber;
      const approveHref = data.approveUrl || `${getAppBaseUrl()}/local-purchases/${docId}/approve`;
      const subject = `Local Purchase ${lpNum} requires Finance approval`;
      const pmName = data.pmApproverName || data.approverName;
      const text = `${greetText}\n\nLocal Purchase ${lpNum} requires Finance approval.${pmName ? `\nProject Manager: ${pmName}` : ''}${comment ? `\nComment: ${comment}` : ''}\n\nOpen: ${approveHref}\n\n${FOOTER}`;
      const html = wrapHtml({
        title: subject,
        greetingLine: greet,
        ctaHref: approveHref,
        ctaLabel: 'Review & Approve',
        bodyHtml: `<p style="margin:0 0 12px;font-size:15px;">Local Purchase <strong>${escapeHtml(lpNum)}</strong> was approved by the project manager and now requires <strong>Finance approval</strong>.</p>
          ${detailsTable(lpDetailRows(data, [
            pmName ? detailRow('Project Manager approver', pmName) : '',
            comment ? detailRow('Approval comment', comment) : '',
          ]))}`,
      });
      return { subject, html, text };
    },

    'local_purchase.pm_approved': () => {
      const docType = 'LOCAL_PURCHASE';
      const docId = data.documentId;
      const lpNum = data.portalLPNumber;
      const viewHref = data.viewUrl || buildDocumentUrl(docType, docId);
      const pmName = data.pmApproverName || data.approverName;
      const subject = `Local Purchase ${lpNum} approved by Project Manager`;
      const text = `${greetText}\n\nThe Project Manager approved Local Purchase ${lpNum}. It has moved to Finance for approval.\n\nOpen: ${viewHref}\n\n${FOOTER}`;
      const html = wrapHtml({
        title: subject,
        greetingLine: greet,
        documentType: docType,
        documentId: docId,
        bodyHtml: `<p style="margin:0 0 12px;font-size:15px;">Local Purchase <strong>${escapeHtml(lpNum)}</strong> was approved by the project manager and has moved to <strong>Finance approval</strong>.</p>
          ${detailsTable(lpDetailRows(data, [
            pmName ? detailRow('Project Manager approver', pmName) : '',
            comment ? detailRow('Approval comment', comment) : '',
          ]))}`,
      });
      return { subject, html, text };
    },

    'local_purchase.completed': () => {
      const docType = 'LOCAL_PURCHASE';
      const docId = data.documentId;
      const lpNum = data.portalLPNumber;
      const completedAt = data.completedAtFormatted || data.completedAt;
      const subject = `Local Purchase ${lpNum} completed`;
      const text = `${greetText}\n\nThe Local Purchase was approved by Finance and completed locally.\n\nOpen: ${buildDocumentUrl(docType, docId)}\n\n${FOOTER}`;
      const html = wrapHtml({
        title: subject,
        greetingLine: greet,
        documentType: docType,
        documentId: docId,
        ctaLabel: 'View Local Purchase',
        bodyHtml: `<p style="margin:0 0 12px;font-size:15px;">The Local Purchase <strong>${escapeHtml(lpNum)}</strong> was approved by Finance and <strong>completed locally</strong>.</p>
          ${lpArabicNote(`اكتمل طلب المشتريات المحلية ${lpNum}`)}
          ${lpArabicNote('تمت موافقة قسم الحسابات واكتمل طلب المشتريات المحلية داخل النظام.')}
          ${detailsTable(lpDetailRows(data, [
            data.pmApproverName ? detailRow('Project Manager approver', data.pmApproverName) : '',
            data.financeApproverName ? detailRow('Finance approver', data.financeApproverName) : '',
            completedAt ? detailRow('Completed', completedAt) : '',
          ]))}`,
      });
      return { subject, html, text };
    },

    'local_purchase.rejected': () => {
      const docId = data.documentId;
      const lpNum = data.portalLPNumber;
      const rejectionReason = data.rejectionReason || comment;
      const editHref = data.editUrl || `${getAppBaseUrl()}/local-purchases/${docId}/edit`;
      const rejectingStep = data.rejectingStep || data.rejectingStepName;
      const rejectingUser = data.rejectingUserName || data.approverName;
      const rejectedAt = data.rejectedAtFormatted || data.rejectedAt;
      const subject = `Local Purchase ${lpNum} rejected`;
      const text = `${greetText}\n\nLocal Purchase ${lpNum} was rejected.${rejectingStep ? `\nStep: ${rejectingStep}` : ''}${rejectingUser ? `\nRejected by: ${rejectingUser}` : ''}\nReason: ${rejectionReason || '—'}\n\nEdit: ${editHref}\n\n${FOOTER}`;
      const html = wrapHtml({
        title: subject,
        greetingLine: greet,
        ctaHref: editHref,
        ctaLabel: 'Edit Local Purchase',
        bodyHtml: `<p style="margin:0 0 12px;font-size:15px;">Local Purchase <strong>${escapeHtml(lpNum)}</strong> was <strong style="color:#b91c1c;">rejected</strong>.</p>
          ${lpArabicNote('تم رفض طلب المشتريات المحلية. يرجى مراجعة سبب الرفض وتعديل الطلب ثم إعادة إرساله.')}
          ${detailsTable([
            detailRow('Local Purchase', lpNum),
            rejectingStep ? detailRow('Rejecting step', rejectingStep) : '',
            rejectingUser ? detailRow('Rejected by', rejectingUser) : '',
            rejectedAt ? detailRow('Date', rejectedAt) : '',
            detailRow('Rejection reason', rejectionReason || '—'),
          ])}`,
      });
      return { subject, html, text };
    },

    'local_purchase.resubmitted': () => {
      const docId = data.documentId;
      const lpNum = data.portalLPNumber;
      const approveHref = data.approveUrl || `${getAppBaseUrl()}/local-purchases/${docId}/approve`;
      const resubmittedAt = data.resubmittedAtFormatted || data.resubmittedAt;
      const previousReason = data.previousRejectionReason || data.rejectionReason;
      const subject = `Local Purchase ${lpNum} resubmitted for approval`;
      const text = `${greetText}\n\nLocal Purchase ${lpNum} was resubmitted by ${data.creatorName || 'Procurement'}.${previousReason ? `\nPrevious rejection: ${previousReason}` : ''}\n\nOpen: ${approveHref}\n\n${FOOTER}`;
      const html = wrapHtml({
        title: subject,
        greetingLine: greet,
        ctaHref: approveHref,
        ctaLabel: 'Review & Approve',
        bodyHtml: `<p style="margin:0 0 12px;font-size:15px;">Local Purchase <strong>${escapeHtml(lpNum)}</strong> was <strong>resubmitted</strong> and requires Project Manager approval again.</p>
          ${detailsTable(lpDetailRows(data, [
            data.creatorName ? detailRow('Resubmitted by', data.creatorName) : '',
            resubmittedAt ? detailRow('Resubmitted', resubmittedAt) : '',
            previousReason ? detailRow('Previous rejection reason', previousReason) : '',
          ]))}`,
      });
      return { subject, html, text };
    },

    'local_purchase.cancelled': () => {
      const docType = 'LOCAL_PURCHASE';
      const docId = data.documentId;
      const lpNum = data.portalLPNumber;
      const cancelledBy = data.cancelledByName || data.approverName;
      const cancellationReason = data.cancellationReason || comment;
      const subject = `Local Purchase ${lpNum} cancelled`;
      const text = `${greetText}\n\nLocal Purchase ${lpNum} was cancelled.${cancelledBy ? `\nCancelled by: ${cancelledBy}` : ''}${cancellationReason ? `\nReason: ${cancellationReason}` : ''}\n\nOpen: ${buildDocumentUrl(docType, docId)}\n\n${FOOTER}`;
      const html = wrapHtml({
        title: subject,
        greetingLine: greet,
        documentType: docType,
        documentId: docId,
        bodyHtml: `<p style="margin:0 0 12px;font-size:15px;">Local Purchase <strong>${escapeHtml(lpNum)}</strong> was <strong>cancelled</strong>.</p>
          ${detailsTable([
            detailRow('Local Purchase', lpNum),
            cancelledBy ? detailRow('Cancelled by', cancelledBy) : '',
            cancellationReason ? detailRow('Reason', cancellationReason) : '',
          ])}`,
      });
      return { subject, html, text };
    },
  };

  const builder = builders[templateKey];
  if (!builder) {
    const subject = data.subject || `Notification: ${templateKey}`;
    const text = data.body || data.text || subject;
    return {
      subject,
      html: wrapHtml({
        title: subject,
        greetingLine: greet,
        bodyHtml: `<p style="margin:0;font-size:15px;">${escapeHtml(text)}</p>`,
      }),
      text,
    };
  }

  return builder();
}
