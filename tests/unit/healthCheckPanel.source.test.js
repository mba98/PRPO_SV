import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PANEL_PATH = path.resolve(
  process.cwd(),
  'components/settings/HealthCheckPanel.jsx',
);

describe('HealthCheckPanel source', () => {
  const source = fs.readFileSync(PANEL_PATH, 'utf8');

  it('does not label health failures as "Failed to Create in SAP"', () => {
    expect(source).not.toContain('Failed to Create in SAP');
  });

  it('does not depend on AnimatedStatusBadge for dependency rows', () => {
    expect(source).not.toMatch(/AnimatedStatusBadge/);
  });

  it('uses the dedicated HealthStatusPill component', () => {
    expect(source).toContain('HealthStatusPill');
  });

  it('renders a generic "Failed" label for down dependencies', () => {
    expect(source).toMatch(/Failed/);
    expect(source).toMatch(/Healthy/);
  });

  it('includes SAP connection test button', () => {
    expect(source).toContain('sap-connection-test-btn');
    expect(source).toContain('/api/sap/connection-test');
  });
});
