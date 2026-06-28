import { describe, expect, it } from 'vitest';
import { buildPoDraftFromPr } from '@/lib/poFromPrDraft.js';
import { sumPoLineTotals } from '@/lib/poFormUtils.js';

const samplePr = {
  portalPRNumber: 'PR-001',
  sapPRDocEntry: 10,
  status: 'Created in SAP',
  requiredDate: '2026-06-01',
  documentDate: '2026-06-01',
  dueDate: '2026-06-15',
  remarks: 'Need urgently',
  lines: [
    {
      _id: 'line1',
      itemCode: 'ITEM1',
      itemName: 'Widget',
      quantity: 4,
      orderedQty: 0,
      vendor: 'V001',
      estimatedUnitPrice: 25,
      uomCode: 'PCS',
      warehouseCode: '01',
    },
  ],
};

describe('buildPoDraftFromPr', () => {
  it('maps PR header and line values into an unsaved draft', () => {
    const draft = buildPoDraftFromPr(samplePr, 'V001');
    expect(draft.vendor).toBe('V001');
    expect(draft.requiredDate).toBe('2026-06-01');
    expect(draft.remarks).toContain('PR-001');
    expect(draft.lines).toHaveLength(1);
    expect(draft.lines[0].itemCode).toBe('ITEM1');
    expect(draft.lines[0].quantity).toBe(4);
    expect(draft.lines[0].unitPrice).toBe(25);
    expect(draft.lines[0].warehouseCode).toBe('01');
  });

  it('calculates draft line totals', () => {
    const draft = buildPoDraftFromPr(samplePr, 'V001');
    expect(draft.lines[0].lineTotal).toBe(100);
    expect(sumPoLineTotals(draft.lines)).toBe(100);
  });
});
