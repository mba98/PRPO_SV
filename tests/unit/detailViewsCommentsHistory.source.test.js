import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const VIEWS = [
  {
    name: 'PR',
    file: 'components/purchase-requests/PrDetailView.jsx',
    documentType: 'PR',
  },
  {
    name: 'PO',
    file: 'components/purchase-orders/PoDetailView.jsx',
    documentType: 'PO',
  },
  {
    name: 'APRI',
    file: 'components/ap-reserve-invoices/ApriDetailView.jsx',
    documentType: 'APRI',
  },
];

describe('detail views Comments and History tabs', () => {
  for (const view of VIEWS) {
    const source = fs.readFileSync(path.resolve(process.cwd(), view.file), 'utf8');

    it(`${view.name} detail includes details, attachments, comments, and history tabs`, () => {
      expect(source).toContain("'details'");
      expect(source).toContain("'attachments'");
      expect(source).toContain("'comments'");
      expect(source).toContain("'history'");
    });

    it(`${view.name} detail wires CommentsPanel and ApprovalTimeline`, () => {
      expect(source).toContain('CommentsPanel');
      expect(source).toContain('ApprovalTimeline');
      expect(source).toContain(`documentType="${view.documentType}"`);
    });
  }
});
