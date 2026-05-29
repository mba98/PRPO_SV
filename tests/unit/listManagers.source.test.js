import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const FILES = [
  'components/purchase-requests/PrListManager.jsx',
  'components/purchase-orders/PoListManager.jsx',
  'components/ap-reserve-invoices/ApriListManager.jsx',
];

describe('list managers URL sync', () => {
  for (const rel of FILES) {
    it(`${rel} uses navigateWithQuery instead of raw router.push for filters`, () => {
      const source = fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');
      expect(source).toContain('navigateWithQuery');
      expect(source).not.toMatch(/useEffect\([^)]*searchParams[^)]*router\.(push|replace)/s);
    });
  }
});
