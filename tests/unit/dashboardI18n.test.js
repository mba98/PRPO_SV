import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getDictionary, statusLabel } from '@/lib/i18n';

describe('Dashboard bilingual i18n', () => {
  const card = fs.readFileSync(
    path.resolve(process.cwd(), 'components/ui/AnimatedDashboardCard.jsx'),
    'utf8',
  );
  const view = fs.readFileSync(
    path.resolve(process.cwd(), 'components/dashboard/DashboardView.jsx'),
    'utf8',
  );

  it('AnimatedDashboardCard uses locale-aware viewList without hardcoded Arabic', () => {
    expect(card).toContain('useI18n');
    expect(card).toContain('dashI18n.viewList');
    expect(card).not.toContain('عرض القائمة');
    expect(card).not.toContain("from '@/lib/i18n'");
    expect(card).not.toMatch(/viewList.*←/);
  });

  it('English dashboard strings include View list arrow', () => {
    const en = getDictionary('en').dashboard;
    expect(en.viewList).toBe('View list →');
    expect(en.noRecentRecords).toBe('No recent records found');
    expect(en.title).toBe('Dashboard');
  });

  it('Arabic dashboard strings include Arabic view list arrow', () => {
    const ar = getDictionary('ar').dashboard;
    expect(ar.viewList).toBe('عرض القائمة ←');
    expect(ar.noRecentRecords).toBe('لا توجد سجلات حديثة');
    expect(ar.title).toBe('لوحة التحكم');
  });

  it('statusLabel localizes Fully Ordered for Arabic and English', () => {
    expect(statusLabel('Fully Ordered', 'en')).toBe('Fully Ordered');
    expect(statusLabel('Fully Ordered', 'ar')).toBe('مطلوب بالكامل');
  });

  it('statusLabel normalizes pending warehouse approval casing', () => {
    expect(statusLabel('pending warehouse approval', 'en')).toBe('Pending Warehouse Approval');
    expect(statusLabel('pending warehouse approval', 'ar')).toBe('بانتظار موافقة المخزن');
  });

  it('DashboardView uses status badges and dashboard empty message', () => {
    expect(view).toContain('AnimatedStatusBadge');
    expect(view).toContain('dashI18n.noRecentRecords');
    expect(view).toContain('formatDate');
    expect(view).not.toContain('pr.noPrs');
  });
});
