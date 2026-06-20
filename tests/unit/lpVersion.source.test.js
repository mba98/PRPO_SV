import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const LP_FORM = path.resolve(process.cwd(), 'components/local-purchases/LpForm.jsx');
const LP_SERVICE = path.resolve(process.cwd(), 'lib/localPurchasesService.js');

describe('LpForm version handling source', () => {
  const source = fs.readFileSync(LP_FORM, 'utf8');

  it('tracks document version in a ref updated after save', () => {
    expect(source).toContain('formVersionRef');
    expect(source).toContain('documentRef');
    expect(source).toContain('applyDocumentUpdate');
    expect(source).toContain('payload.__v = formVersionRef.current');
    expect(source).not.toContain('initialDoc.__v');
  });

  it('extracts document from normalized API response', () => {
    expect(source).toContain('extractLocalPurchaseDocument');
    expect(source).toContain('primePortalDocument');
  });

  it('prevents duplicate save/submit requests', () => {
    expect(source).toContain('if (isSaving || isSubmitting) return');
    expect(source).toContain('type="button"');
    expect(source).not.toContain('type="submit"');
    expect(source).toContain('disabled={isSaving || isSubmitting}');
  });

  it('handles VERSION_CONFLICT without clearing the form', () => {
    expect(source).toContain("json.error === 'VERSION_CONFLICT'");
    expect(source).toContain('refreshLatestVersion');
    expect(source).toContain('lpI18n.versionConflict');
  });

  it('includes currency selector and money inputs', () => {
    expect(source).toContain('lpI18n.currency');
    expect(source).toContain('MoneyInput');
    expect(source).toContain('formatMoneyWithCurrency');
    expect(source).toContain('lpI18n.currencyChangeWarning');
  });
});

describe('localPurchasesService atomic update source', () => {
  const source = fs.readFileSync(LP_SERVICE, 'utf8');

  it('uses conditional findOneAndUpdate with version increment', () => {
    expect(source).toContain('LocalPurchase.findOneAndUpdate');
    expect(source).toContain('{ _id: id, __v: data.__v }');
    expect(source).toContain('$inc: { __v: 1 }');
    expect(source).toContain("err.code = 'VERSION_CONFLICT'");
  });

  it('does not import SAP helpers', () => {
    expect(source).not.toMatch(/from '@\/lib\/sap/);
  });
});
