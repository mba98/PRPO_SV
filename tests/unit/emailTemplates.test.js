import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildWorkflowEmail, buildDocumentUrl, getAppBaseUrl } from '@/lib/emailTemplates';

describe('emailTemplates', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.APP_BASE_URL = 'https://portal.example.com';
    process.env.NEXT_PUBLIC_APP_URL = '';
  });

  afterEach(() => {
    process.env.APP_BASE_URL = originalEnv.APP_BASE_URL;
    process.env.NEXT_PUBLIC_APP_URL = originalEnv.NEXT_PUBLIC_APP_URL;
  });

  it('includes document number in subject and body', () => {
    const { subject, html, text } = buildWorkflowEmail('po.finance.approved', {
      portalPONumber: 'PO-20260525-0001',
      documentId: '64b8c1a52f5b1b2c3d4e5f61',
    });
    expect(subject).toContain('PO-20260525-0001');
    expect(html).toContain('PO-20260525-0001');
    expect(text).toContain('PO-20260525-0001');
  });

  it('includes recipient name in greeting when provided', () => {
    const { html, text } = buildWorkflowEmail('pr.created', {
      portalPRNumber: 'PR-001',
      documentId: 'abc123',
      recipientName: 'Jane Doe',
    });
    expect(html).toContain('Jane Doe');
    expect(text).toContain('Dear Jane Doe');
  });

  it('includes CTA link with base URL', () => {
    const docId = '64b8c1a52f5b1b2c3d4e5f61';
    const { html } = buildWorkflowEmail('po.created', {
      portalPONumber: 'PO-001',
      documentId: docId,
    });
    const expected = buildDocumentUrl('PO', docId);
    expect(expected).toBe(`https://portal.example.com/purchase-orders/${docId}`);
    expect(html).toContain(expected);
    expect(html).toContain('Open Purchase Order');
  });

  it('does not render undefined or null in HTML output', () => {
    const { html, text } = buildWorkflowEmail('pr.rejected', {
      portalPRNumber: 'PR-99',
      documentId: 'id1',
    });
    expect(html).not.toMatch(/undefined|null/);
    expect(text).not.toMatch(/undefined|null/);
  });

  it('uses relative path when base URL is missing', () => {
    delete process.env.APP_BASE_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(getAppBaseUrl()).toBe('');
    expect(buildDocumentUrl('PR', 'doc1')).toBe('/purchase-requests/doc1');
  });

  it('builds pr.sap.created template with SAP doc number', () => {
    const { subject, html } = buildWorkflowEmail('pr.sap.created', {
      portalPRNumber: 'PR-10',
      documentId: 'x',
      docNum: '12345',
    });
    expect(subject).toContain('created in SAP');
    expect(html).toContain('12345');
  });
});
