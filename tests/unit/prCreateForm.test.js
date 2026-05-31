import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getDictionary } from '@/lib/i18n';

describe('PR create form — compact bilingual UI', () => {
  const form = fs.readFileSync(
    path.resolve(process.cwd(), 'components/purchase-requests/PrCreateForm.jsx'),
    'utf8',
  );
  const combobox = fs.readFileSync(
    path.resolve(process.cwd(), 'components/lookups/SapLookupCombobox.jsx'),
    'utf8',
  );
  const itemSearch = fs.readFileSync(
    path.resolve(process.cwd(), 'components/lookups/ItemSearchInput.jsx'),
    'utf8',
  );
  const dropzone = fs.readFileSync(
    path.resolve(process.cwd(), 'components/attachments/AttachmentDropzone.jsx'),
    'utf8',
  );

  it('does not render line remarks or default RAN004 warehouse', () => {
    expect(form).not.toMatch(/l\.remarks/);
    expect(form).not.toContain('updateLine(idx, { remarks');
    expect(form).not.toContain('RAN004');
    expect(form).not.toContain('DEFAULT_WAREHOUSE');
    expect(form).toContain("warehouseCode: ''");
  });

  it('validates missing warehouse with localized message', () => {
    expect(form).toContain('warehouseRequired');
    expect(form).toContain('validateForm');
    const en = getDictionary('en').pr.create;
    const ar = getDictionary('ar').pr.create;
    expect(en.warehouseRequired).toBe('Warehouse is required');
    expect(ar.warehouseRequired).toBe('المخزن مطلوب');
  });

  it('SapLookupCombobox hides suggestions until query typed', () => {
    expect(combobox).toContain('focused');
    expect(combobox).toContain('queryMin');
    expect(combobox).toContain('trimmed.length < queryMin');
    expect(combobox).not.toContain('onFocus={() => setOpen(true)}');
  });

  it('ItemSearchInput hides suggestions when query empty', () => {
    expect(itemSearch).toContain('focused');
    expect(itemSearch).toContain('query.trim().length >= 1');
  });

  it('uses AttachmentDropzone with drag-and-drop copy', () => {
    expect(form).toContain('AttachmentDropzone');
    expect(dropzone).toContain('border-dashed');
    expect(dropzone).toContain('onFilesChange');
    expect(dropzone).toContain('removeAt');
    const en = getDictionary('en').pr.create;
    expect(en.dropFiles).toContain('Drag files here');
  });

  it('uses useI18n and primary button styles', () => {
    expect(form).toContain('useI18n');
    expect(form).toContain('pr.create');
    expect(form).toContain('btn-primary');
    expect(form).not.toContain('عرض القائمة');
  });

  it('Arabic and English create labels exist', () => {
    expect(getDictionary('en').pr.create.submitForApproval).toBe('Submit for approval');
    expect(getDictionary('ar').pr.create.submitForApproval).toBe('إرسال للموافقة');
    expect(getDictionary('en').pr.createDesc).toContain('Enter request details');
    expect(getDictionary('ar').pr.createDesc).toContain('أدخل تفاصيل الطلب');
  });
});
