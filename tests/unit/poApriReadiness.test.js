import { describe, expect, it } from 'vitest';
import { poIsReadyForApri, filterPosReadyForApri } from '@/lib/poApriReadiness';

describe('poApriReadiness', () => {
  const readyPo = {
    _id: 'po1',
    status: 'Created in SAP',
    sapPODocEntry: 10,
  };

  it('accepts PO created in SAP with DocEntry and no APRI', () => {
    expect(poIsReadyForApri(readyPo)).toBe(true);
  });

  it('rejects PO without SAP DocEntry', () => {
    expect(poIsReadyForApri({ ...readyPo, sapPODocEntry: null })).toBe(false);
  });

  it('rejects PO with wrong status', () => {
    expect(poIsReadyForApri({ ...readyPo, status: 'Pending Finance Approval' })).toBe(false);
  });

  it('rejects when APRI already exists', () => {
    expect(poIsReadyForApri(readyPo, { _id: 'apri1' })).toBe(false);
  });

  it('filters list excluding POs with APRI', () => {
    const map = new Map([['po1', { _id: 'apri1' }]]);
    const result = filterPosReadyForApri([readyPo, { _id: 'po2', status: 'Created in SAP', sapPODocEntry: 2 }], map);
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe('po2');
  });
});
