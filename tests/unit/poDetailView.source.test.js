import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PO_DETAIL = path.resolve(
  process.cwd(),
  'components/purchase-orders/PoDetailView.jsx',
);

describe('PoDetailView source', () => {
  const source = fs.readFileSync(PO_DETAIL, 'utf8');

  it('uses API canApproveCurrentStep for approve button visibility', () => {
    expect(source).toContain('const canApprove = po.canApproveCurrentStep === true');
  });

  it('shows waiting message for non-approvers', () => {
    expect(source).toContain('waitingForApproval');
  });

  it('uses API-provided retry permission and loading state', () => {
    expect(source).toContain('po.canRetrySap');
    expect(source).toContain('retryingSap');
    expect(source).toContain('loading={retryingSap}');
    expect(source).toContain('if (retryingSap) return');
  });
});
