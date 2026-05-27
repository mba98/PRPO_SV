/**
 * Default recipient resolution when EmailGroup is missing, inactive, or empty.
 * roleNames match seed/roles.js. useRequester adds the document requester email from context.
 */
export const WORKFLOW_EMAIL_EVENT_KEYS = [
  'pr.created',
  'pr.whs.approved',
  'pr.pm.approved',
  'pr.rejected',
  'pr.sap.created',
  'pr.sap.failed',
  'po.created',
  'po.pm.approved',
  'po.finance.approved',
  'po.rejected',
  'po.sap.created',
  'po.sap.failed',
  'apri.sap.created',
  'apri.sap.failed',
];

export const EVENT_FALLBACK_RECIPIENTS = {
  'pr.created': { roleNames: ['WHS Approver'] },
  'pr.whs.approved': { roleNames: ['Project Manager'] },
  'pr.pm.approved': { roleNames: ['Requester'], useRequester: true },
  'pr.rejected': { roleNames: ['Requester'], useRequester: true },
  'pr.sap.created': { roleNames: ['Requester', 'Admin'], useRequester: true },
  'pr.sap.failed': { roleNames: ['Admin'] },
  'po.created': { roleNames: ['Project Manager'] },
  'po.pm.approved': { roleNames: ['Finance'] },
  'po.finance.approved': { roleNames: ['Requester', 'Procurement'], useRequester: true },
  'po.rejected': { roleNames: ['Requester'], useRequester: true },
  'po.sap.created': { roleNames: ['Requester', 'Procurement', 'Admin'], useRequester: true },
  'po.sap.failed': { roleNames: ['Admin'] },
  'apri.sap.created': { roleNames: ['Finance', 'WHS Approver', 'Procurement'] },
  'apri.sap.failed': { roleNames: ['Admin'] },
};

export const EVENT_LABELS = {
  'pr.created': 'PR submitted for approval',
  'pr.whs.approved': 'PR approved by warehouse — pending PM',
  'pr.pm.approved': 'PR fully approved',
  'pr.rejected': 'PR rejected',
  'pr.sap.created': 'PR created in SAP',
  'pr.sap.failed': 'PR SAP creation failed',
  'po.created': 'PO created — pending PM approval',
  'po.pm.approved': 'PO approved by PM — pending Finance',
  'po.finance.approved': 'PO fully approved',
  'po.rejected': 'PO rejected',
  'po.sap.created': 'PO created in SAP',
  'po.sap.failed': 'PO SAP creation failed',
  'apri.sap.created': 'APRI created in SAP',
  'apri.sap.failed': 'APRI SAP creation failed',
};
