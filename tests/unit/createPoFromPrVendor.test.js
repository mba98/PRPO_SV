import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getDictionary } from '@/lib/i18n';

const PO_CREATION_SOURCES = [
  {
    name: 'CreatePoFromPrPanel',
    path: 'components/purchase-requests/CreatePoFromPrPanel.jsx',
  },
  {
    name: 'ApprovedForPoManager',
    path: 'components/purchase-requests/ApprovedForPoManager.jsx',
  },
  {
    name: 'PoEditForm',
    path: 'components/purchase-orders/PoEditForm.jsx',
  },
];

const SHARED_CURRENCY_MODULE = 'components/purchase-orders/PoBusinessFields.jsx';

describe('PO creation paths share SAP vendor currency rules', () => {
  const businessFields = fs.readFileSync(
    path.resolve(process.cwd(), SHARED_CURRENCY_MODULE),
    'utf8',
  );

  it('PoBusinessFields loads vendor currencies through shared hook', () => {
    const hook = fs.readFileSync(
      path.resolve(process.cwd(), 'lib/hooks/useVendorCurrencyConfig.js'),
      'utf8',
    );
    const client = fs.readFileSync(
      path.resolve(process.cwd(), 'lib/vendorCurrencyClient.js'),
      'utf8',
    );
    expect(businessFields).toContain('useVendorCurrencyConfig');
    expect(hook).toContain('fetchVendorCurrencyConfig');
    expect(client).toContain('/api/sap/vendors/');
    expect(client).toContain('/currencies');
    expect(businessFields).toContain('applyCurrencyChangeToHeader');
    expect(businessFields).toContain('loadingVendorCurrencies');
    expect(businessFields).not.toContain('PO_DOC_CURRENCIES');
  });

  it('PoBusinessFields auto-loads SAP exchange rates as read-only DocRate', () => {
    expect(businessFields).toContain('usePoExchangeRate');
    expect(businessFields).toContain('loadingExchangeRate');
    expect(businessFields).toContain('reloadExchangeRate');
    expect(businessFields).toContain('readOnly');
    expect(businessFields).not.toMatch(/onChange=\{.*docRate/);
  });

  for (const source of PO_CREATION_SOURCES) {
    describe(source.name, () => {
      const contents = fs.readFileSync(path.resolve(process.cwd(), source.path), 'utf8');

      it('uses shared PoBusinessFields for vendor currency UI', () => {
        expect(contents).toContain('PoBusinessFields');
      });

      it('does not use static PO_DOC_CURRENCIES dropdown', () => {
        expect(contents).not.toContain('PO_DOC_CURRENCIES');
      });

      it('does not duplicate legacy vendor currency header helpers', () => {
        expect(contents).not.toContain('applyVendorCurrencyToHeader');
        expect(contents).not.toContain('applyCurrencyChangeToHeader');
      });

      it('submits docCurrency from shared header state without client docRate', () => {
        expect(contents).toContain('docCurrency: header.docCurrency');
        expect(contents).toContain('getPoExchangeRateSubmitBlocker');
        expect(contents).toContain('onExchangeRateStateChange');
        expect(contents).not.toMatch(/docRate:\s*[\n\r\s]*header\.docRate/);
      });
    });
  }

  it('CreatePoFromPrPanel and ApprovedForPoManager build PR drafts the same way', () => {
    const createPanel = fs.readFileSync(
      path.resolve(process.cwd(), 'components/purchase-requests/CreatePoFromPrPanel.jsx'),
      'utf8',
    );
    const approvedManager = fs.readFileSync(
      path.resolve(process.cwd(), 'components/purchase-requests/ApprovedForPoManager.jsx'),
      'utf8',
    );
    expect(createPanel).toContain('buildPoDraftFromPr');
    expect(approvedManager).toContain('buildPoDraftFromPr');
    expect(createPanel).toContain('relatedPRLineId');
    expect(approvedManager).toContain('relatedPRLineId');
  });
});

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

  it('ApprovedForPoManager uses searchable VendorSelect and shared PoBusinessFields', () => {
    expect(manager).toContain('VendorSelect');
    expect(manager).toContain('PoBusinessFields');
    expect(manager).toContain('loadAllOnFocus');
    expect(manager).not.toContain('datalist');
    expect(manager).toContain('handleVendorSelect');
    expect(manager).not.toContain('PO_DOC_CURRENCIES');
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
    expect(manager).toContain('draft.header.vendor.trim()');
  });

  it('create button shows loading and prevents double submit', () => {
    expect(manager).toContain('loading={submitting}');
    expect(manager).toContain('c.creatingPurchaseOrder');
    expect(manager).toContain('if (submitting');
  });

  it('CreatePoFromPrPanel uses searchable VendorSelect and full draft form', () => {
    expect(createPoPanel).toContain('VendorSelect');
    expect(createPoPanel).toContain('PoBusinessFields');
    expect(createPoPanel).toContain('buildPoDraftFromPr');
    expect(createPoPanel).toContain('loading={submitting}');
    expect(createPoPanel).toContain('if (submitting || !draft) return');
    expect(createPoPanel).toContain('handleCreate');
    expect(createPoPanel).toContain('relatedPRLineId');
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
    expect(en.po.create.loadingVendorCurrencies).toContain('Loading');
    expect(ar.po.create.vendor).toContain('المجهز');
    expect(ar.po.create.noVendorsFound).toContain('مجهزون');
    expect(ar.po.create.creatingPurchaseOrder).toContain('جاري');
    expect(ar.po.create.multiCurrencyVendorHint).toContain('عملة');
  });
});
