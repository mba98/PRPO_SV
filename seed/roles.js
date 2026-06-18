import { ALL_PERMISSIONS } from '../lib/permissions.js';

export { ALL_PERMISSIONS };

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
    permissions: ['po.create', 'po.approve.pm'],
  },
  {
    name: 'Operation Manager',
    permissions: ['po.approve.om'],
  },
  {
    name: 'Finance',
    permissions: ['po.approve.finance', 'apinvoice.create'],
  },
  {
    name: 'Procurement',
    permissions: ['po.create', 'apinvoice.create', 'apri.create.sap', 'items.create'],
  },
];
