import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { lp as lpEn } from '@/lib/i18n/en.js';
import { lp as lpAr } from '@/lib/i18n/ar.js';

const LP_FORM = path.resolve(process.cwd(), 'components/local-purchases/LpForm.jsx');
const LP_DETAIL = path.resolve(process.cwd(), 'components/local-purchases/LpDetailView.jsx');
const LP_LIST = path.resolve(process.cwd(), 'components/local-purchases/LpListManager.jsx');

const LP_LIST_I18N_KEYS = [
  'myTab',
  'pendingTab',
  'rejectedTab',
  'completedTab',
  'allTab',
  'portalNumber',
  'requestDate',
  'budget',
  'documentTotal',
  'numberOfItems',
  'createNew',
  'noItems',
  'view',
  'createdBy',
];

function expectClientComponentWithUseI18n(source, label) {
  expect(source.startsWith("'use client'"), `${label} must be a client component`).toBe(true);
  expect(source, `${label} must import useI18n`).toMatch(
    /import\s+\{\s*useI18n\s*\}\s+from\s+['"]@\/lib\/hooks\/useI18n['"]/,
  );
}

describe('Local Purchase i18n keys', () => {
  it('defines list manager keys in English and Arabic', () => {
    for (const key of LP_LIST_I18N_KEYS) {
      expect(lpEn[key], `en lp.${key}`).toBeTruthy();
      expect(lpAr[key], `ar lp.${key}`).toBeTruthy();
    }
  });
});

describe('LpForm source', () => {
  const source = fs.readFileSync(LP_FORM, 'utf8');

  it('is a client component and imports useI18n', () => {
    expectClientComponentWithUseI18n(source, 'LpForm');
  });
  it('uses header-level budget field', () => {
    expect(source).toContain('budget: Number(header.budget)');
    expect(source).toContain('lpI18n.budget');
    expect(source).toContain('lpI18n.requestDate');
    expect(source).toContain('lpI18n.currency');
    expect(source).toContain('lpI18n.remarks');
  });

  it('does not show budget as a line-table column', () => {
    expect(source).not.toMatch(/lpI18n\.budget[\s\S]{0,200}<th>/);
    expect(source).not.toContain('line.budget');
    expect(source).not.toContain('lpI18n.uom');
    expect(source).not.toContain('lpI18n.vendorName');
  });

  it('line table shows item, quantity, estimated price, line notes, total', () => {
    expect(source).toContain('lpI18n.item');
    expect(source).toContain('lpI18n.quantity');
    expect(source).toContain('lpI18n.estimatedPrice');
    expect(source).toContain('lpI18n.lineNotes');
    expect(source).toContain('lpI18n.lineTotal');
  });

  it('save draft uses buildPayload without throwing', () => {
    expect(source).toContain('function buildPayload()');
    expect(source).toContain('handleSaveDraft');
    expect(source).toContain('budget: Number(header.budget)');
    expect(source).toContain('extractLocalPurchaseDocument');
  });
});

describe('LpDetailView source', () => {
  const source = fs.readFileSync(LP_DETAIL, 'utf8');

  it('is a client component and imports useI18n', () => {
    expectClientComponentWithUseI18n(source, 'LpDetailView');
  });

  it('shows budget in header section', () => {
    expect(source).toContain('lpI18n.budget');
    expect(source).toContain('lpI18n.currency');
    expect(source).toContain('formatMoneyWithCurrency');
    expect(source).toContain('lpI18n.generalRemarks');
    expect(source).toContain('lpI18n.requestDate');
  });

  it('line table excludes budget column', () => {
    expect(source).not.toContain('line.budget');
    expect(source).not.toContain('lpI18n.uom');
  });

  it('shows document total in footer', () => {
    expect(source).toContain('lpI18n.documentTotal');
  });
});

describe('LpListManager source', () => {
  const source = fs.readFileSync(LP_LIST, 'utf8');

  it('is a client component and imports useI18n', () => {
    expectClientComponentWithUseI18n(source, 'LpListManager');
  });

  it('shows request-level budget and document total columns', () => {
    expect(source).toContain('lpI18n.budget');
    expect(source).toContain('formatMoneyWithCurrency');
    expect(source).toContain('lpI18n.documentTotal');
    expect(source).toContain('lpI18n.numberOfItems');
    expect(source).toContain('lpI18n.requestDate');
  });

  it('does not show legacy vendor or currency columns', () => {
    expect(source).not.toContain('lpI18n.vendorName');
    expect(source).not.toContain('lpI18n.currency');
  });
});
