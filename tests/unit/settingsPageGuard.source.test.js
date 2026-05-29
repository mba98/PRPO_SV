import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const GUARD_PATH = path.resolve(process.cwd(), 'components/settings/SettingsPageGuard.jsx');

describe('SettingsPageGuard source', () => {
  const source = fs.readFileSync(GUARD_PATH, 'utf8');

  it('does not subscribe to getEffectivePermissions from zustand (avoids infinite re-renders)', () => {
    expect(source).not.toMatch(/useAuthStore\([^)]*getEffectivePermissions/);
    expect(source).toContain('useEffectivePermissions');
  });
});
