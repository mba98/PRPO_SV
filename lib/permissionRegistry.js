/**
 * Canonical permission registry — single source of truth for RBAC keys.
 * Each permission: { key, label, group, description, active }
 */

export const PERMISSION_REGISTRY = [
  // Purchase Requests
  { key: 'pr.view', label: 'View own purchase requests', group: 'pr', description: 'View PRs the user created or can access.', active: true },
  { key: 'pr.view.all', label: 'View all purchase requests', group: 'pr', description: 'Read-only access to all PRs.', active: true },
  { key: 'pr.create', label: 'Create purchase requests', group: 'pr', description: 'Create new PRs.', active: true },
  { key: 'pr.edit', label: 'Edit purchase requests', group: 'pr', description: 'Edit draft or rejected PRs (Procurement).', active: true },
  { key: 'pr.submit', label: 'Submit purchase requests', group: 'pr', description: 'Submit draft PRs into approval.', active: true },
  { key: 'pr.resubmit', label: 'Resubmit rejected purchase requests', group: 'pr', description: 'Resubmit rejected PRs after edit.', active: true },
  { key: 'pr.approve.whs', label: 'Approve PR — warehouse', group: 'pr', description: 'Approve the warehouse PR step when active.', active: true },
  { key: 'pr.approve.pm', label: 'Approve PR — project manager', group: 'pr', description: 'Approve the PM PR step when active.', active: true },
  { key: 'pr.reject', label: 'Reject purchase requests', group: 'pr', description: 'Reject at the current PR approval step (requires matching step permission).', active: true },
  { key: 'pr.retry.sap', label: 'Retry SAP PR creation', group: 'pr', description: 'Operational SAP retry override for PR.', active: true },

  // Purchase Orders
  { key: 'po.view', label: 'View purchase orders', group: 'po', description: 'View POs in workflow queues.', active: true },
  { key: 'po.view.all', label: 'View all purchase orders', group: 'po', description: 'Read-only access to all POs.', active: true },
  { key: 'po.create', label: 'Create purchase orders', group: 'po', description: 'Create POs from approved PRs.', active: true },
  { key: 'po.edit', label: 'Edit purchase orders', group: 'po', description: 'Edit draft or rejected POs (Procurement).', active: true },
  { key: 'po.submit', label: 'Submit purchase orders', group: 'po', description: 'Submit draft POs into approval.', active: true },
  { key: 'po.resubmit', label: 'Resubmit rejected purchase orders', group: 'po', description: 'Resubmit rejected POs after edit.', active: true },
  { key: 'po.approve.pm', label: 'Approve PO — project manager', group: 'po', description: 'Approve the PM PO step when active.', active: true },
  { key: 'po.approve.om', label: 'Approve PO — operation manager', group: 'po', description: 'Approve the OM PO step when active.', active: true },
  { key: 'po.approve.finance', label: 'Approve PO — finance', group: 'po', description: 'Approve the Finance PO step when active.', active: true },
  { key: 'po.reject', label: 'Reject purchase orders', group: 'po', description: 'Reject at the current PO approval step.', active: true },
  { key: 'po.retry.sap', label: 'Retry SAP PO creation', group: 'po', description: 'Operational SAP retry override for PO.', active: true },

  // APRI
  { key: 'apri.view', label: 'View A/P reserve invoices', group: 'apri', description: 'View APRI documents.', active: true },
  { key: 'apri.view.all', label: 'View all A/P reserve invoices', group: 'apri', description: 'Read-only access to all APRIs.', active: true },
  { key: 'apri.create', label: 'Create A/P reserve invoices', group: 'apri', description: 'Create APRI from PO.', active: true },
  { key: 'apri.edit', label: 'Edit A/P reserve invoices', group: 'apri', description: 'Edit APRI before approval completes.', active: true },
  { key: 'apri.submit', label: 'Submit A/P reserve invoices', group: 'apri', description: 'Submit APRI into approval.', active: true },
  { key: 'apri.resubmit', label: 'Resubmit rejected APRIs', group: 'apri', description: 'Resubmit rejected APRIs.', active: true },
  { key: 'apri.approve.whs', label: 'Approve APRI — warehouse', group: 'apri', description: 'Approve warehouse APRI step when active.', active: true },
  { key: 'apri.reject', label: 'Reject A/P reserve invoices', group: 'apri', description: 'Reject at current APRI step.', active: true },
  { key: 'apri.create.sap', label: 'Create APRI in SAP', group: 'apri', description: 'Post APRI to SAP.', active: true },
  { key: 'apri.retry.sap', label: 'Retry APRI SAP posting', group: 'apri', description: 'Retry failed APRI SAP posting.', active: true },

  // Local Purchases
  { key: 'lp.view', label: 'View own local purchases', group: 'lp', description: 'View own LP documents.', active: true },
  { key: 'lp.view.all', label: 'View all local purchases', group: 'lp', description: 'Read-only access to all LPs.', active: true },
  { key: 'lp.create', label: 'Create local purchases', group: 'lp', description: 'Create LP documents.', active: true },
  { key: 'lp.edit', label: 'Edit local purchases', group: 'lp', description: 'Edit draft or rejected LPs.', active: true },
  { key: 'lp.submit', label: 'Submit local purchases', group: 'lp', description: 'Submit LP into approval.', active: true },
  { key: 'lp.resubmit', label: 'Resubmit rejected local purchases', group: 'lp', description: 'Resubmit rejected LPs.', active: true },
  { key: 'lp.approve.pm', label: 'Approve LP — project manager', group: 'lp', description: 'Approve PM LP step when active.', active: true },
  { key: 'lp.approve.finance', label: 'Approve LP — finance', group: 'lp', description: 'Approve Finance LP step when active.', active: true },
  { key: 'lp.reject', label: 'Reject local purchases', group: 'lp', description: 'Reject at current LP step.', active: true },
  { key: 'lp.cancel', label: 'Cancel local purchases', group: 'lp', description: 'Cancel eligible LP documents.', active: true },

  // Items / SAP
  { key: 'items.create', label: 'Create SAP items', group: 'items', description: 'Create items in SAP.', active: true },
  { key: 'sap.pr.create', label: 'Force SAP PR creation', group: 'sap', description: 'Admin override to create SAP PR.', active: true },
  { key: 'sap.pr.retry', label: 'Force SAP PR retry', group: 'sap', description: 'Admin override SAP PR retry.', active: true },
  { key: 'sap.po.create', label: 'Force SAP PO creation', group: 'sap', description: 'Admin override to create SAP PO.', active: true },
  { key: 'sap.po.retry', label: 'Force SAP PO retry', group: 'sap', description: 'Admin override SAP PO retry.', active: true },
  { key: 'sap.apri.create', label: 'Force SAP APRI creation', group: 'sap', description: 'Admin override APRI SAP create.', active: true },
  { key: 'sap.apri.retry', label: 'Force SAP APRI retry', group: 'sap', description: 'Admin override APRI SAP retry.', active: true },

  // Administration
  { key: 'admin.users', label: 'Manage users', group: 'admin', description: 'User administration.', active: true },
  { key: 'admin.roles', label: 'Manage roles', group: 'admin', description: 'Role administration.', active: true },
  { key: 'admin.permissions', label: 'Manage permissions', group: 'admin', description: 'Permission catalog administration.', active: true },
  { key: 'admin.approval_matrix', label: 'Manage approval matrix', group: 'admin', description: 'Approval matrix configuration.', active: true },
  { key: 'admin.email_groups', label: 'Manage email groups', group: 'admin', description: 'Email group configuration.', active: true },
  { key: 'admin.sap_integration', label: 'SAP integration settings', group: 'admin', description: 'SAP integration admin pages.', active: true },
  { key: 'admin.system_logs', label: 'View system logs', group: 'admin', description: 'Email and SAP integration logs.', active: true },
  { key: 'admin.settings', label: 'Legacy admin settings', group: 'admin', description: 'Legacy umbrella admin permission (prefer granular admin.*).', active: true },

  // Global read / emergency
  { key: 'view.all', label: 'View all documents (read-only)', group: 'view', description: 'Read-only cross-module document visibility.', active: true },
  { key: 'system.super_admin', label: 'Super administrator', group: 'system', description: 'Emergency unrestricted access — audit all uses.', active: true },

  // Legacy keys kept for migration (inactive in catalog UI, mapped at runtime)
  { key: 'apinvoice.create', label: 'Create A/P reserve invoices (legacy)', group: 'legacy', description: 'Alias for apri.create — migrate to apri.create.', active: false },
];

/** Keys considered active for new assignments */
export const ACTIVE_PERMISSION_KEYS = PERMISSION_REGISTRY.filter((p) => p.active).map((p) => p.key);

/** All keys including legacy/inactive */
export const ALL_REGISTRY_KEYS = PERMISSION_REGISTRY.map((p) => p.key);

/** Runtime aliases: new key → legacy keys that satisfy it during migration */
export const PERMISSION_LEGACY_ALIASES = {
  'pr.edit': ['pr.create'],
  'pr.submit': ['pr.create'],
  'pr.resubmit': ['pr.create'],
  'po.edit': ['po.create'],
  'po.submit': ['po.create'],
  'po.resubmit': ['po.create'],
  'apri.create': ['apinvoice.create'],
  'apri.edit': ['apinvoice.create'],
  'apri.submit': ['apinvoice.create'],
  'apri.resubmit': ['apinvoice.create'],
  'admin.email_groups': ['admin.settings'],
  'admin.sap_integration': ['admin.settings'],
  'admin.system_logs': ['admin.settings'],
  'pr.view.all': ['view.all'],
  'po.view.all': ['view.all'],
  'apri.view.all': ['view.all'],
};

export function getPermissionMeta(key) {
  return PERMISSION_REGISTRY.find((p) => p.key === key) || null;
}

export function buildPermissionLabels() {
  return Object.fromEntries(PERMISSION_REGISTRY.map((p) => [p.key, p.label]));
}

export function buildPermissionGroups() {
  const groups = new Map();
  for (const perm of PERMISSION_REGISTRY.filter((p) => p.active && p.group !== 'legacy')) {
    if (!groups.has(perm.group)) {
      groups.set(perm.group, { id: perm.group, label: perm.group.toUpperCase(), permissions: [] });
    }
    groups.get(perm.group).permissions.push(perm.key);
  }
  const labels = {
    pr: 'Purchase Requests (PR)',
    po: 'Purchase Orders (PO)',
    apri: 'A/P Reserve Invoices (APRI)',
    lp: 'Local Purchases',
    items: 'Items',
    sap: 'SAP Operations',
    admin: 'Administration',
    view: 'View',
    system: 'System',
  };
  return [...groups.values()].map((g) => ({ ...g, label: labels[g.id] || g.label }));
}
