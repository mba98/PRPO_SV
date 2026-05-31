import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const timelinePath = path.resolve(
  process.cwd(),
  'components/approval-history/ApprovalTimeline.jsx',
);
const enPath = path.resolve(process.cwd(), 'lib/i18n/en.js');
const arPath = path.resolve(process.cwd(), 'lib/i18n/ar.js');

describe('ApprovalTimeline RTL and i18n', () => {
  const source = fs.readFileSync(timelinePath, 'utf8');
  const en = fs.readFileSync(enPath, 'utf8');
  const ar = fs.readFileSync(arPath, 'utf8');

  it('uses isRtl for LTR left-side timeline line and dots', () => {
    expect(source).toContain('isRtl');
    expect(source).toContain("left-[18px]'");
    expect(source).toContain("left-[12px]'");
    expect(source).not.toMatch(/border-l border-border pl-6/);
  });

  it('uses right-side timeline line and dots for RTL', () => {
    expect(source).toContain("right-[18px]'");
    expect(source).toContain("right-[12px]'");
    expect(source).toContain("pr-10 text-start'");
  });

  it('localizes history actions via history i18n keys', () => {
    expect(source).toContain('historyActionLabel');
    expect(source).toContain('ACTION_I18N_KEY');
    expect(en).toContain('history.created');
    expect(ar).toContain('تم الإنشاء');
    expect(ar).toContain('تم رفع مرفق');
  });
});
