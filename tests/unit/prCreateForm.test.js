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
  const warehouse = fs.readFileSync(
    path.resolve(process.cwd(), 'components/lookups/WarehouseSelect.jsx'),
    'utf8',
  );
  const searchable = fs.readFileSync(
    path.resolve(process.cwd(), 'components/lookups/SearchableLookup.jsx'),
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

  it('WarehouseSelect uses searchable lookup with HANA warehouses API', () => {
    expect(warehouse).toContain('SearchableLookup');
    expect(warehouse).toContain('/api/sap/warehouses');
    expect(warehouse).toContain('loadAllOnFocus');
    expect(searchable).toContain('onFocus={() => setFocused(true)}');
    expect(searchable).toContain('loadAllOnFocus');
    expect(getDictionary('en').pr.create.noWarehousesFound).toBe('No warehouses found');
    expect(getDictionary('ar').pr.create.noWarehousesFound).toBe('لا توجد مخازن');
  });

  it('ItemSearchInput fetches full item details on select', () => {
    expect(itemSearch).toContain('/details');
    expect(itemSearch).toContain('uomGroupEntry');
    expect(itemSearch).toContain('warehouseCode');
    expect(itemSearch).toContain('estimatedUnitPrice');
  });

  it('ItemSearchInput shows Create New Item inside dropdown', () => {
    expect(itemSearch).toContain('onCreateNew');
    expect(itemSearch).toContain('canCreateNew');
    expect(itemSearch).toContain('showCreateOption');
    expect(form).not.toContain('noResultsLine');
  });

  it('ProjectSelect opens list on focus with loadAllOnFocus', () => {
    const project = fs.readFileSync(
      path.resolve(process.cwd(), 'components/lookups/ProjectSelect.jsx'),
      'utf8',
    );
    expect(project).toContain('loadAllOnFocus');
    expect(project).toContain('minChars={0}');
  });

  it('Item and Vendor lookups still require typing before suggestions', () => {
    expect(combobox).toContain('queryMin');
    expect(combobox).toContain('trimmed.length < queryMin');
    expect(itemSearch).toContain('query.trim().length >= 1');
    expect(form).toContain('noWarehousesFound');
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
