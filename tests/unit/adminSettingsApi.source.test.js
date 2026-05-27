import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('admin settings API routes', () => {
  it('users API requires admin.users', () => {
    const src = read('app/api/users/route.js');
    expect(src).toMatch(/admin\.users/);
    expect(src).not.toMatch(/passwordHash/);
  });

  it('roles API requires admin.roles', () => {
    expect(read('app/api/roles/route.js')).toMatch(/admin\.roles/);
  });

  it('approval matrix API requires admin.approval_matrix', () => {
    expect(read('app/api/approval-matrix/route.js')).toMatch(/admin\.approval_matrix/);
  });

  it('email groups API requires admin.settings', () => {
    expect(read('app/api/email-groups/route.js')).toMatch(/admin\.settings/);
  });

  it('health and SAP connection test require admin.settings', () => {
    expect(read('app/api/health/route.js')).toMatch(/admin\.settings/);
    expect(read('app/api/sap/connection-test/route.js')).toMatch(/admin\.settings/);
  });

  it('SAP connection test does not return password or session', () => {
    const src = read('app/api/sap/connection-test/route.js');
    expect(src).not.toMatch(/password/i);
    expect(src).not.toMatch(/B1SESSION/);
  });
});

describe('admin settings UI secrets', () => {
  it('HealthCheckPanel does not expose password inputs or hash fields', () => {
    const src = read('components/settings/HealthCheckPanel.jsx');
    expect(src).not.toMatch(/type="password"/);
    expect(src).not.toMatch(/passwordHash/);
    expect(src).toContain('sap-connection-test-btn');
  });

  it('sanitizeUser strips passwordHash', () => {
    const src = read('lib/authLogin.js');
    expect(src).toMatch(/passwordHash/);
    expect(src).not.toMatch(/passwordHash:/);
  });
});

describe('cursor-prompt phase markers', () => {
  it('marks all phases 0-11 as completed', () => {
    const doc = read('cursor-prompt-procurement-portal.merged.md');
    for (let i = 0; i <= 11; i += 1) {
      expect(doc).toMatch(new RegExp(`Phase ${i}.*Completed`, 'i'));
    }
  });
});
