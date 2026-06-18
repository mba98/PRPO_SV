import { describe, expect, it } from 'vitest';
import { ALL_PERMISSIONS, DEFAULT_ROLES } from '@/seed/roles';
import { DEFAULT_APPROVAL_MATRIX } from '@/seed/approvalMatrix';
import { DEFAULT_EMAIL_GROUPS } from '@/seed/emailGroups';
import { DEFAULT_TEST_USERS, syncDefaultRolePermissions } from '@/seed/users';

describe('seed data definitions', () => {
  it('defines default roles including Admin with all permissions', () => {
    expect(DEFAULT_ROLES.length).toBeGreaterThanOrEqual(7);
    const admin = DEFAULT_ROLES.find((r) => r.name === 'Admin');
    expect(admin.permissions).toEqual(ALL_PERMISSIONS);

    const pm = DEFAULT_ROLES.find((r) => r.name === 'Project Manager');
    expect(pm.permissions).toEqual(['po.create', 'po.approve.pm']);

    const om = DEFAULT_ROLES.find((r) => r.name === 'Operation Manager');
    expect(om.permissions).toEqual(['po.approve.om']);

    const finance = DEFAULT_ROLES.find((r) => r.name === 'Finance');
    expect(finance.permissions).toEqual(['po.approve.finance', 'apinvoice.create']);

    const procurement = DEFAULT_ROLES.find((r) => r.name === 'Procurement');
    expect(procurement.permissions).toEqual([
      'po.create',
      'apinvoice.create',
      'apri.create.sap',
      'items.create',
    ]);
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

  it('defines PR, PO and APRI approval matrix steps', () => {
    const prSteps = DEFAULT_APPROVAL_MATRIX.filter((s) => s.documentType === 'PR');
    const poSteps = DEFAULT_APPROVAL_MATRIX.filter((s) => s.documentType === 'PO');
    const apriSteps = DEFAULT_APPROVAL_MATRIX.filter((s) => s.documentType === 'APRI');
    expect(prSteps).toHaveLength(1);
    expect(poSteps).toHaveLength(3);
    expect(apriSteps).toHaveLength(1);
  });

  it('exports syncDefaultRolePermissions for dev role updates', () => {
    expect(typeof syncDefaultRolePermissions).toBe('function');
  });

  it('defines email groups for all Phase 8 events', () => {
    expect(DEFAULT_EMAIL_GROUPS.length).toBeGreaterThanOrEqual(16);
    const keys = DEFAULT_EMAIL_GROUPS.map((g) => g.eventKey);
    expect(new Set(keys).size).toBe(16);
  });
});
