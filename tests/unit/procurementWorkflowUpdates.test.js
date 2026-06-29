import { describe, expect, it, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  enforcePrLineUom,
  enforcePoLineUom,
  resolveStoredLineUom,
} from '@/lib/lineUomEnforcement.js';
import {
  sanitizeApriFinancialFields,
  userCanViewApriFinancials,
} from '@/lib/apriFinancialAccess.js';
import {
  userCanResubmitApri,
  userCanEditApriQuantities,
} from '@/lib/apReserveInvoicesService.js';
import { buildWorkflowEmail } from '@/lib/emailTemplates.js';
import { dedupeEmailsCaseInsensitive } from '@/lib/lpEmailRecipients.js';
import { searchSapVendors, mapHanaVendorRow } from '@/lib/sapLookups.js';
import { buildVendorSearchSql } from '@/lib/sap/hanaSql.js';
import { isApriReadyForSapCreation, APRI_STATUS } from '@/lib/apriStatus.js';
import { apriRowsForExport } from '@/lib/excelExport.js';
import { handleServiceError } from '@/lib/apiHelpers.js';

vi.mock('@/lib/sapHana.js', () => ({
  getItemDetail: vi.fn(),
  searchVendors: vi.fn(),
}));

import { getItemDetail, searchVendors } from '@/lib/sapHana.js';

const PROC_USER = {
  id: 'proc1',
  _id: 'proc1',
  permissions: ['apri.create', 'apri.edit', 'apri.resubmit', 'apri.view.financials'],
};
const WHS_USER = {
  id: 'whs1',
  permissions: ['apri.approve.whs'],
};
const OWNER = { id: 'owner1', _id: 'owner1', permissions: ['apri.create'] };

function readComponent(relPath) {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
}

describe('Procurement workflow updates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Part 1 — UoM read-only', () => {
    it('PR forms use read-only LineUomDisplay instead of UomGroupSelect', () => {
      expect(readComponent('components/purchase-requests/PrCreateForm.jsx')).toContain('LineUomDisplay');
      expect(readComponent('components/purchase-requests/PrCreateForm.jsx')).not.toContain('UomGroupSelect');
      expect(readComponent('components/purchase-requests/PrEditForm.jsx')).toContain('LineUomDisplay');
      expect(readComponent('components/purchase-orders/PoBusinessFields.jsx')).toContain('LineUomDisplay');
    });

    it('rejects manipulated PR UoM when item unchanged', async () => {
      getItemDetail.mockResolvedValue([{ uomCode: 'PCS', uom: 'Pieces' }]);
      const existing = { itemCode: 'A1', uomCode: 'PCS', uom: 'Pieces' };
      await expect(
        enforcePrLineUom({ itemCode: 'A1', uomCode: 'BOX' }, existing),
      ).rejects.toMatchObject({ code: 'UOM_IMMUTABLE' });
    });

    it('derives UoM from SAP item master on new PR line', async () => {
      getItemDetail.mockResolvedValue([{ uomCode: 'PCS', UOM: 'Pieces' }]);
      const line = await enforcePrLineUom({ itemCode: 'A1', uomCode: 'PCS' });
      expect(line.uomCode).toBe('PCS');
    });

    it('PO line preserves UoM from source PR line and rejects mismatch', async () => {
      const prLine = { itemCode: 'A1', uomCode: 'PCS', uom: 'Pieces' };
      const line = await enforcePoLineUom({ itemCode: 'A1', uomCode: 'PCS' }, { prLine });
      expect(line.uomCode).toBe('PCS');
      await expect(
        enforcePoLineUom({ itemCode: 'A1', uomCode: 'BOX' }, { prLine }),
      ).rejects.toMatchObject({ code: 'UOM_IMMUTABLE' });
    });

    it('PO-from-PR mapper ignores client uom override', () => {
      const src = readComponent('lib/sap/poFromPrSap.js');
      expect(src).toContain('resolveLineUomCode(prLine)');
      expect(src).not.toMatch(/submitted\.uomCode/);
    });
  });

  describe('Part 2 — PR rejection email', () => {
    it('includes rejection reason, step, and procurement note', () => {
      const { html, text, subject } = buildWorkflowEmail('pr.rejected', {
        portalPRNumber: 'PR-2026-0001',
        documentId: 'abc',
        rejectionReason: 'Wrong warehouse',
        rejectingStep: 'Warehouse Approval',
        rejectingUserName: 'Jane Approver',
      });
      expect(subject).toContain('PR-2026-0001');
      expect(text).toContain('Wrong warehouse');
      expect(text).toContain('Warehouse Approval');
      expect(text).toContain('Jane Approver');
      expect(text).toContain('returned to Procurement');
      expect(html).toContain('تم إرجاع الطلب');
    });

    it('deduplicates recipients case-insensitively', () => {
      expect(dedupeEmailsCaseInsensitive(['A@x.com', 'a@x.com', 'B@x.com'])).toEqual([
        'A@x.com',
        'B@x.com',
      ]);
    });
  });

  describe('Part 4 — HANA vendor lookup', () => {
    it('buildVendorSearchSql filters suppliers and uses parameters', () => {
      const sql = buildVendorSearchSql('SBO_COMPANY', 50, 50);
      expect(sql).toContain('"CardType" = \'S\'');
      expect(sql).toContain('LIKE UPPER(?)');
      expect(sql).toContain('OFFSET 50 ROWS');
    });

    it('searchSapVendors maps HANA rows with pagination', async () => {
      searchVendors.mockResolvedValue({
        items: [{ vendorCode: 'V999', vendorName: 'Far Vendor', currency: 'USD' }],
        pagination: { page: 1, limit: 20, total: 500, totalPages: 25 },
      });
      const result = await searchSapVendors('V999', 20, 1);
      expect(result.items[0].cardCode).toBe('V999');
      expect(result.pagination.total).toBe(500);
      expect(mapHanaVendorRow({ vendorCode: 'V1', vendorName: 'One' }).cardCode).toBe('V1');
    });
  });

  describe('Part 5 — APRI warehouse financial sanitization', () => {
    const fullApri = {
      id: '1',
      portalAPNumber: 'AP-1',
      docCurrency: 'USD',
      docRate: 1.2,
      lines: [
        {
          _id: 'l1',
          itemCode: 'ITM1',
          itemName: 'Widget',
          quantity: 2,
          uomCode: 'PCS',
          unitPrice: 10,
          lineTotal: 20,
          relatedPOLineNum: 0,
        },
      ],
    };

    it('warehouse user without financial permission cannot view prices', () => {
      expect(userCanViewApriFinancials(WHS_USER)).toBe(false);
      const sanitized = sanitizeApriFinancialFields(fullApri, false);
      expect(sanitized.lines[0].itemCode).toBe('ITM1');
      expect(sanitized.lines[0].quantity).toBe(2);
      expect(sanitized.lines[0].unitPrice).toBeUndefined();
      expect(sanitized.lines[0].lineTotal).toBeUndefined();
      expect(sanitized.docCurrency).toBeUndefined();
      expect(sanitized.lines[0].relatedPOLineNum).toBeUndefined();
    });

    it('procurement user with financial permission sees prices', () => {
      expect(userCanViewApriFinancials(PROC_USER)).toBe(true);
      const sanitized = sanitizeApriFinancialFields(fullApri, true);
      expect(sanitized.lines[0].unitPrice).toBe(10);
    });

    it('export omits total amount for non-financial users', () => {
      const rows = apriRowsForExport([fullApri], { includeFinancials: false });
      expect(rows[0]['Total Amount']).toBeUndefined();
      expect(rows[0]['Lines Count']).toBe(1);
    });
  });

  describe('Part 6 — APRI reject/resubmit workflow', () => {
    const rejectedApri = {
      status: APRI_STATUS.WAREHOUSE_REJECTED,
      createdBy: 'owner1',
      sapAPDocEntry: null,
    };

    it('procurement owner can edit quantities and resubmit rejected APRI', () => {
      expect(userCanEditApriQuantities({ ...OWNER, permissions: ['apri.edit'] }, rejectedApri)).toBe(true);
      expect(userCanResubmitApri({ ...OWNER, permissions: ['apri.resubmit'] }, rejectedApri)).toBe(true);
    });

    it('warehouse cannot edit or resubmit', () => {
      expect(userCanEditApriQuantities(WHS_USER, rejectedApri)).toBe(false);
      expect(userCanResubmitApri(WHS_USER, rejectedApri)).toBe(false);
    });

    it('rejected APRI is not SAP-ready until re-approved', () => {
      expect(isApriReadyForSapCreation(APRI_STATUS.WAREHOUSE_REJECTED)).toBe(false);
      expect(isApriReadyForSapCreation(APRI_STATUS.WAREHOUSE_APPROVED)).toBe(true);
    });

    it('resubmit email notifies warehouse approver', () => {
      const { subject, html } = buildWorkflowEmail('apri.resubmitted', {
        portalAPNumber: 'AP-55',
        documentId: 'x',
        status: APRI_STATUS.PENDING_WAREHOUSE,
      });
      expect(subject).toContain('AP-55');
      expect(html).toContain('resubmitted');
    });
  });

  describe('Part 7 — PO Line UI removal', () => {
    it('APRI detail view does not show PO Line column', () => {
      const src = readComponent('components/ap-reserve-invoices/ApriDetailView.jsx');
      expect(src).not.toContain('detail.poLine');
      expect(src).not.toContain('relatedPOLineNum');
    });

    it('SAP mapper still sends BaseLine internally', () => {
      const src = readComponent('lib/sap/mappers/apReserveInvoiceToSap.js');
      expect(src).toContain('BaseLine: line.relatedPOLineNum');
    });
  });

  describe('API helpers', () => {
    it('returns 400 for UOM_IMMUTABLE', async () => {
      const err = new Error('Unit of measure cannot be changed');
      err.code = 'UOM_IMMUTABLE';
      const res = handleServiceError(err);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('UOM_IMMUTABLE');
    });
  });
});
