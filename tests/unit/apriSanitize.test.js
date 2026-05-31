import { describe, expect, it } from 'vitest';
import { sanitizeApri } from '@/lib/apReserveInvoicesService.js';

describe('sanitizeApri', () => {
  it('does not expose sapResponse in API payload', () => {
    const doc = {
      _id: '507f1f77bcf86cd799439011',
      portalAPNumber: 'APRI-001',
      status: 'Draft',
      sapResponse: { secret: 'internal-sap-payload' },
      lines: [],
    };
    const out = sanitizeApri(doc);
    expect(out).not.toHaveProperty('sapResponse');
    expect(out.portalAPNumber).toBe('APRI-001');
  });
});
