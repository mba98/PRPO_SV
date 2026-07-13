/**
 * Default email groups — one row per Phase 8 notification event.
 * Recipients use role-based resolution (overrides can be edited in admin UI later).
 */
export const DEFAULT_EMAIL_GROUPS = [
  { eventKey: 'pr.created', roleNames: ['WHS Approver'] },
  { eventKey: 'pr.whs.approved', roleNames: ['Project Manager'] },
  { eventKey: 'pr.pm.approved', roleNames: ['Requester'] },
  { eventKey: 'pr.rejected', roleNames: ['Requester'] },
  { eventKey: 'pr.sap.created', roleNames: ['Requester', 'Admin'] },
  { eventKey: 'pr.sap.failed', roleNames: ['Admin'] },
  { eventKey: 'po.created', roleNames: ['Project Manager'] },
  { eventKey: 'po.pm.approved', roleNames: ['Operation Manager'] },
  { eventKey: 'po.om.approved', roleNames: ['Finance'] },
  { eventKey: 'po.finance.approved', roleNames: ['Requester', 'Procurement'] },
  { eventKey: 'po.rejected', roleNames: ['Requester'] },
  { eventKey: 'po.sap.created', roleNames: ['Requester', 'Procurement', 'Admin'] },
  { eventKey: 'po.sap.failed', roleNames: ['Admin'] },
  { eventKey: 'apri.warehouse.approved', roleNames: ['Procurement'] },
  { eventKey: 'apri.warehouse.rejected', roleNames: ['Procurement'] },
  { eventKey: 'apri.sap.created', roleNames: ['Finance', 'Procurement'] },
  { eventKey: 'apri.sap.failed', roleNames: ['Admin', 'Procurement'] },
];
