import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getDictionary } from '@/lib/i18n';

describe('Create PO from PR vendor suggestions', () => {
  const vendorSelect = fs.readFileSync(
    path.resolve(process.cwd(), 'components/lookups/VendorSelect.jsx'),
    'utf8',
  );
  const lookupStyles = fs.readFileSync(
    path.resolve(process.cwd(), 'components/lookups/lookupInputStyles.js'),
    'utf8',
  );
  const manager = fs.readFileSync(
    path.resolve(process.cwd(), 'components/purchase-requests/ApprovedForPoManager.jsx'),
    'utf8',
  );
  const createPoPanel = fs.readFileSync(
    path.resolve(process.cwd(), 'components/purchase-requests/CreatePoFromPrPanel.jsx'),
    'utf8',
  );
  const prDetail = fs.readFileSync(
    path.resolve(process.cwd(), 'components/purchase-requests/PrDetailView.jsx'),
    'utf8',
  );

  it('VendorSelect supports loadAllOnFocus and SAP vendors API', () => {
    expect(vendorSelect).toContain('loadAllOnFocus');
    expect(vendorSelect).toContain('/api/sap/vendors');
    expect(vendorSelect).toContain('loadVendors');
    expect(vendorSelect).toContain('onFocus');
    expect(vendorSelect).toContain('SAP_LOOKUP_INPUT_CLASS');
    expect(lookupStyles).toContain('h-11');
    expect(lookupStyles).toContain('max-h-72');
    expect(lookupStyles).toContain('hover:bg-primary/10');
  });

  it('ApprovedForPoManager uses default VendorSelect sizing (no invalid input class)', () => {
    expect(manager).not.toContain('inputClassName="input');
    expect(manager).not.toContain('datalist');
  });

  it('ApprovedForPoManager uses searchable VendorSelect', () => {
    expect(manager).toContain('VendorSelect');
    expect(manager).toContain('loadAllOnFocus');
    expect(manager).not.toContain('datalist');
    expect(manager).toContain('setVendor(code)');
    expect(manager).toContain('setVendorLabel');
  });

  it('typing uses debounced vendor fetch', () => {
    expect(vendorSelect).toContain('debounceMs');
    expect(vendorSelect).toContain('setTimeout(() => loadVendors(trimmed)');
  });

  it('selecting vendor sets CardCode and display label', () => {
    expect(vendorSelect).toContain('vendor.cardCode');
    expect(vendorSelect).toContain('vendorDisplayLabel');
    expect(vendorSelect).toContain('setFocused(false)');
  });

  it('submit without vendor shows validation', () => {
    expect(manager).toContain('c.vendorRequired');
    expect(manager).toContain('!vendor.trim()');
  });

  it('create button shows loading and prevents double submit', () => {
    expect(manager).toContain('loading={submitting}');
    expect(manager).toContain('c.creatingPurchaseOrder');
    expect(manager).toContain('if (submitting) return');
  });

  it('CreatePoFromPrPanel uses searchable VendorSelect and shared create i18n', () => {
    expect(createPoPanel).toContain('VendorSelect');
    expect(createPoPanel).toContain('loadAllOnFocus');
    expect(createPoPanel).not.toContain('datalist');
    expect(createPoPanel).toContain('setVendor(code)');
    expect(createPoPanel).toContain('setVendorLabel');
    expect(createPoPanel).toContain('loading={submitting}');
    expect(createPoPanel).toContain('if (submitting) return');
    expect(createPoPanel).toContain('vendor: vendorCode');
  });

  it('PrDetailView retry SAP button has loading guard', () => {
    expect(prDetail).toContain('retryingSap');
    expect(prDetail).toContain('if (retryingSap) return');
    expect(prDetail).toContain('loading={retryingSap}');
    expect(prDetail).toContain('detail.retrying');
  });

  it('Arabic and English po.create vendor labels exist', () => {
    const en = getDictionary('en');
    const ar = getDictionary('ar');
    expect(en.po.create.vendor).toContain('Vendor');
    expect(en.po.create.loadingVendors).toContain('Loading');
    expect(ar.po.create.vendor).toContain('المجهز');
    expect(ar.po.create.noVendorsFound).toContain('مجهزون');
    expect(ar.po.create.creatingPurchaseOrder).toContain('جاري');
  });
});
