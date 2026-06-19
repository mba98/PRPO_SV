import { describe, expect, it } from 'vitest';
import {
  getEffectivePermissions,
  userHasEffectivePermission,
} from '@/lib/effectivePermissions';

describe('effectivePermissions', () => {
  it('merges role and user permissions', () => {
    const user = {
      permissions: [],
      role: { permissions: ['pr.approve.pm', 'po.create'] },
    };
    expect(getEffectivePermissions(user)).toEqual(['pr.approve.pm', 'po.create']);
  });

  it('deduplicates overlapping permissions', () => {
    const user = {
      permissions: ['pr.create'],
      role: { permissions: ['pr.create', 'view.all'] },
    };
    expect(getEffectivePermissions(user)).toEqual(['pr.create', 'view.all']);
  });

  it('checks effective permission membership', () => {
    const user = { permissions: [], role: { permissions: ['pr.approve.pm'] } };
    expect(userHasEffectivePermission(user, 'pr.approve.pm')).toBe(true);
    expect(userHasEffectivePermission(user, 'view.all')).toBe(false);
  });

  it('extracts permission keys from populated permission objects', () => {
    const user = {
      permissions: [{ key: 'apri.create.sap' }],
      role: { permissions: [{ key: 'apinvoice.create' }, 'po.create'] },
    };
    expect(getEffectivePermissions(user).sort()).toEqual(
      ['apri.create.sap', 'apinvoice.create', 'po.create'].sort(),
    );
  });
});
