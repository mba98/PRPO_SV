import { ACTIVE_PERMISSION_KEYS, ALL_REGISTRY_KEYS } from '../lib/permissionRegistry.js';

export { ALL_REGISTRY_KEYS as ALL_PERMISSIONS, ACTIVE_PERMISSION_KEYS };

export const DEFAULT_ROLES = [
  {
    name: 'Admin',
    permissions: [...ACTIVE_PERMISSION_KEYS],
  },
  {
    name: 'Requester',
    permissions: ['pr.view', 'pr.create', 'pr.submit'],
  },
  {
    name: 'WHS Approver',
    permissions: ['pr.view', 'pr.approve.whs', 'apri.view', 'apri.approve.whs'],
  },
  {
    name: 'Project Manager',
    permissions: ['po.view', 'po.approve.pm', 'lp.view', 'lp.approve.pm'],
  },
  {
    name: 'Operation Manager',
    permissions: ['po.view', 'po.approve.om'],
  },
  {
    name: 'Finance',
    permissions: [
      'po.view',
      'po.approve.finance',
      'apri.view',
      'apri.create',
      'apri.create.sap',
      'lp.view',
      'lp.approve.finance',
    ],
  },
  {
    name: 'Procurement',
    permissions: [
      'pr.view',
      'pr.create',
      'pr.edit',
      'pr.submit',
      'pr.resubmit',
      'po.view',
      'po.create',
      'po.edit',
      'po.submit',
      'po.resubmit',
      'apri.view',
      'apri.create',
      'apri.create.sap',
      'lp.view',
      'lp.create',
      'lp.edit',
      'lp.submit',
      'lp.resubmit',
      'items.create',
    ],
  },
];
