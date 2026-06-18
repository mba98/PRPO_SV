import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const APRI_DETAIL = path.resolve(
  process.cwd(),
  'components/ap-reserve-invoices/ApriDetailView.jsx',
);

describe('ApriDetailView source', () => {
  const source = fs.readFileSync(APRI_DETAIL, 'utf8');

  it('uses API canApproveCurrentStep for approve button visibility', () => {
    expect(source).toContain('const canApprove = apri.canApproveCurrentStep === true');
  });

  it('uses API canCreateInSap for Create in SAP button visibility', () => {
    expect(source).toContain('const canCreateInSap = apri.canCreateInSap === true');
  });
});
