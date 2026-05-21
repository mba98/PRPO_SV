import { describe, expect, it } from 'vitest';
import { ALL_PERMISSIONS, DEFAULT_ROLES } from '@/seed/roles';
import { DEFAULT_APPROVAL_MATRIX } from '@/seed/approvalMatrix';
import { DEFAULT_EMAIL_GROUPS } from '@/seed/emailGroups';

describe('seed data definitions', () => {
  it('defines six default roles including Admin with all permissions', () => {
    expect(DEFAULT_ROLES).toHaveLength(6);
    const admin = DEFAULT_ROLES.find((r) => r.name === 'Admin');
    expect(admin.permissions).toEqual(ALL_PERMISSIONS);
  });

  it('defines PR and PO approval matrix steps', () => {
    const prSteps = DEFAULT_APPROVAL_MATRIX.filter((s) => s.documentType === 'PR');
    const poSteps = DEFAULT_APPROVAL_MATRIX.filter((s) => s.documentType === 'PO');
    expect(prSteps).toHaveLength(2);
    expect(poSteps).toHaveLength(2);
  });

  it('defines email groups for all Phase 8 events', () => {
    expect(DEFAULT_EMAIL_GROUPS).toHaveLength(14);
    const keys = DEFAULT_EMAIL_GROUPS.map((g) => g.eventKey);
    expect(new Set(keys).size).toBe(14);
  });
});
