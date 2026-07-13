import { describe, expect, it } from 'vitest';
import { ALL_PERMISSIONS, DEFAULT_ROLES } from '@/seed/roles';
import { DEFAULT_APPROVAL_MATRIX } from '@/seed/approvalMatrix';
import { DEFAULT_EMAIL_GROUPS } from '@/seed/emailGroups';
import { DEFAULT_TEST_USERS, syncDefaultRolePermissions } from '@/seed/users';
import { ACTIVE_PERMISSION_KEYS } from '@/lib/permissionRegistry.js';

describe('seed data definitions', () => {
  it('defines default roles including Admin with all active permissions', () => {
    expect(DEFAULT_ROLES.length).toBeGreaterThanOrEqual(7);
    const admin = DEFAULT_ROLES.find((r) => r.name === 'Admin');
    expect(admin.permissions).toEqual(ACTIVE_PERMISSION_KEYS);

    const pm = DEFAULT_ROLES.find((r) => r.name === 'Project Manager');
    expect(pm.permissions).toEqual(['po.view', 'po.approve.pm', 'lp.view', 'lp.approve.pm']);

    const om = DEFAULT_ROLES.find((r) => r.name === 'Operation Manager');
    expect(om.permissions).toEqual(['po.view', 'po.approve.om']);

    const finance = DEFAULT_ROLES.find((r) => r.name === 'Finance');
    expect(finance.permissions).toEqual([
      'po.view',
      'po.approve.finance',
      'apri.view',
      'apri.create',
      'apri.create.sap',
      'lp.view',
      'lp.approve.finance',
    ]);

    const whs = DEFAULT_ROLES.find((r) => r.name === 'WHS Approver');
    expect(whs.permissions).toEqual(['pr.view', 'pr.approve.whs', 'apri.view', 'apri.approve.whs']);
    expect(whs.permissions).not.toContain('view.all');
    expect(whs.permissions).not.toContain('po.approve.pm');

    const procurement = DEFAULT_ROLES.find((r) => r.name === 'Procurement');
    expect(procurement.permissions).toContain('po.create');
    expect(procurement.permissions).toContain('pr.edit');
    expect(procurement.permissions).not.toContain('po.approve.pm');
  });

  it('defines default test users with unique usernames and role names', () => {
    expect(DEFAULT_TEST_USERS).toHaveLength(6);
    const usernames = DEFAULT_TEST_USERS.map((u) => u.username);
    expect(new Set(usernames).size).toBe(6);
    const roleNames = new Set(DEFAULT_ROLES.map((r) => r.name));
    for (const user of DEFAULT_TEST_USERS) {
      expect(roleNames.has(user.roleName)).toBe(true);
    }
  });

  it('defines PR, PO, APRI and LOCAL_PURCHASE approval matrix steps', () => {
    const prSteps = DEFAULT_APPROVAL_MATRIX.filter((s) => s.documentType === 'PR');
    const poSteps = DEFAULT_APPROVAL_MATRIX.filter((s) => s.documentType === 'PO');
    const apriSteps = DEFAULT_APPROVAL_MATRIX.filter((s) => s.documentType === 'APRI');
    const lpSteps = DEFAULT_APPROVAL_MATRIX.filter((s) => s.documentType === 'LOCAL_PURCHASE');
    expect(prSteps).toHaveLength(1);
    expect(poSteps).toHaveLength(3);
    expect(apriSteps).toHaveLength(1);
    expect(apriSteps[0].requiredPermission).toBe('apri.approve.whs');
    expect(lpSteps).toHaveLength(2);
  });

  it('exports syncDefaultRolePermissions for dev role updates', () => {
    expect(typeof syncDefaultRolePermissions).toBe('function');
  });

  it('defines email groups for all Phase 8 events', () => {
    expect(DEFAULT_EMAIL_GROUPS.length).toBeGreaterThanOrEqual(17);
    const keys = DEFAULT_EMAIL_GROUPS.map((g) => g.eventKey);
    expect(new Set(keys).size).toBe(17);
    expect(keys).toContain('po.om.approved');
    const pmApproved = DEFAULT_EMAIL_GROUPS.find((g) => g.eventKey === 'po.pm.approved');
    expect(pmApproved.roleNames).toEqual(['Operation Manager']);
    const omApproved = DEFAULT_EMAIL_GROUPS.find((g) => g.eventKey === 'po.om.approved');
    expect(omApproved.roleNames).toEqual(['Finance']);
  });

  it('ALL_PERMISSIONS export includes legacy migration keys', () => {
    expect(ALL_PERMISSIONS).toContain('apinvoice.create');
    expect(ALL_PERMISSIONS.length).toBeGreaterThanOrEqual(ACTIVE_PERMISSION_KEYS.length);
  });
});
