/**
 * Default approval matrix rows — role names resolved to ObjectIds at seed time.
 *
 * Workflow sequence:
 * PR:  Warehouse → SAP PR
 * PO:  PM → Operation Manager → Finance → SAP PO
 * APRI: Warehouse → SAP A/P Reserve Invoice
 */
export const DEFAULT_APPROVAL_MATRIX = [
  {
    documentType: 'PR',
    stepOrder: 1,
    stepName: 'Warehouse Approval',
    requiredPermission: 'pr.approve.whs',
    approverRoleName: 'WHS Approver',
  },
  {
    documentType: 'PO',
    stepOrder: 1,
    stepName: 'Project Manager Approval',
    requiredPermission: 'po.approve.pm',
    approverRoleName: 'Project Manager',
  },
  {
    documentType: 'PO',
    stepOrder: 2,
    stepName: 'Operation Manager Approval',
    requiredPermission: 'po.approve.om',
    approverRoleName: 'Operation Manager',
  },
  {
    documentType: 'PO',
    stepOrder: 3,
    stepName: 'Finance Approval',
    requiredPermission: 'po.approve.finance',
    approverRoleName: 'Finance',
  },
  {
    documentType: 'APRI',
    stepOrder: 1,
    stepName: 'Warehouse Approval',
    requiredPermission: 'pr.approve.whs',
    approverRoleName: 'WHS Approver',
  },
];
