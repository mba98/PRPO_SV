import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getDictionary } from '@/lib/i18n';

describe('Approved for PO page i18n and RTL', () => {
  const manager = fs.readFileSync(
    path.resolve(process.cwd(), 'components/purchase-requests/ApprovedForPoManager.jsx'),
    'utf8',
  );

  it('ApprovedForPoManager uses useI18n and pr.approvedForPo', () => {
    expect(manager).toContain('useI18n');
    expect(manager).toContain('pr.approvedForPo');
    expect(manager).not.toContain('Create Purchase Order');
    expect(manager).not.toContain('PR Number');
  });

  it('uses logical text-start for table headers', () => {
    expect(manager).toContain('text-start');
    expect(manager).not.toMatch(/text-left/);
  });

  it('Arabic approved-for-po labels exist', () => {
    const ar = getDictionary('ar');
    expect(ar.pr.approvedForPo.createTitle).toContain('إنشاء');
    expect(ar.pr.approvedForPo.emptyList).toContain('لا توجد');
    expect(ar.pr.approvedForPo.colDepartment).toBe('القسم');
  });

  it('English approved-for-po labels exist', () => {
    const en = getDictionary('en');
    expect(en.pr.approvedForPo.createButton).toBe('Create purchase order');
    expect(en.pr.approvedForPo.colPrNumber).toBe('PR number');
  });
});
