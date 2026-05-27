import { describe, expect, it } from 'vitest';
import {
  prRowsForExport,
  poRowsForExport,
  apriRowsForExport,
  buildWorkbookBuffer,
  exportFilename,
} from '@/lib/excelExport';

describe('excelExport', () => {
  it('maps PR rows with required columns', () => {
    const rows = prRowsForExport([
      {
        portalPRNumber: 'PR-001',
        sapPRDocNum: '100',
        requesterName: 'Alice',
        department: 'IT',
        project: 'P1',
        warehouse: 'WH1',
        status: 'Approved',
        requiredDate: '2026-05-01',
        createdAt: '2026-05-02T10:00:00Z',
        lines: [{ quantity: 2, estimatedUnitPrice: 10 }],
      },
    ]);
    expect(rows[0]['Portal PR Number']).toBe('PR-001');
    expect(rows[0]['Total Amount']).toBe(20);
    expect(rows[0]['Lines Count']).toBe(1);
  });

  it('does not include secrets in export rows', () => {
    const rows = poRowsForExport([
      {
        portalPONumber: 'PO-1',
        relatedPRNumber: 'PR-1',
        sapPODocNum: '200',
        vendor: 'V1',
        status: 'Created in SAP',
        lines: [],
        sapResponse: { B1SESSION: 'secret' },
      },
    ]);
    expect(JSON.stringify(rows)).not.toContain('B1SESSION');
    expect(JSON.stringify(rows)).not.toContain('secret');
  });

  it('builds xlsx buffer', () => {
    const buffer = buildWorkbookBuffer([{ A: 1 }], 'Sheet1');
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(100);
  });

  it('exportFilename uses date stamp', () => {
    expect(exportFilename('purchase-requests')).toMatch(/^purchase-requests-\d{8}\.xlsx$/);
  });

  it('maps APRI rows', () => {
    const rows = apriRowsForExport([
      {
        portalAPNumber: 'AP-1',
        relatedPONumber: 'PO-1',
        sapAPDocNum: '300',
        vendor: 'V',
        status: 'Created in SAP',
        lines: [{ lineTotal: 5 }],
      },
    ]);
    expect(rows[0]['Portal AP Number']).toBe('AP-1');
    expect(rows[0]['ReserveInvoice']).toBeUndefined();
  });
});
