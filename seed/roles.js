export const ALL_PERMISSIONS = [
  'pr.create',
  'pr.approve.whs',
  'pr.approve.pm',
  'po.create',
  'po.approve.pm',
  'po.approve.finance',
  'apinvoice.create',
  'items.create',
  'admin.users',
  'admin.roles',
  'admin.approval_matrix',
  'admin.settings',
  'view.all',
];

export const DEFAULT_ROLES = [
  {
    name: 'Admin',
    permissions: [...ALL_PERMISSIONS],
  },
  {
    name: 'Requester',
    permissions: ['pr.create'],
  },
  {
    name: 'WHS Approver',
    permissions: ['pr.approve.whs'],
  },
  {
    name: 'Project Manager',
    permissions: ['pr.approve.pm', 'po.approve.pm'],
  },
  {
    name: 'Finance',
    permissions: ['po.approve.finance'],
  },
  {
    name: 'Procurement',
    permissions: ['po.create', 'apinvoice.create'],
  },
];
