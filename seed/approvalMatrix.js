/**
 * Default approval matrix rows — role names resolved to ObjectIds at seed time.
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
    documentType: 'PR',
    stepOrder: 2,
    stepName: 'Project Manager Approval',
    requiredPermission: 'pr.approve.pm',
    approverRoleName: 'Project Manager',
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
    stepName: 'Finance Approval',
    requiredPermission: 'po.approve.finance',
    approverRoleName: 'Finance',
  },
];
