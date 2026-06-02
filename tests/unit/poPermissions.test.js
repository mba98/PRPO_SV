import { describe, expect, it } from 'vitest';
import {
  canRetrySapPurchaseOrder,
  canShowCreatePoAction,
  canViewPurchaseOrdersNav,
  isPrEligibleForPoCreation,
} from '@/lib/poPermissions';
import { getVisibleNavItems } from '@/lib/navigation';

describe('PO permissions and navigation', () => {
  it('shows Purchase Orders nav for Admin with view.all via role', () => {
    const user = { permissions: [], role: { permissions: ['view.all', 'admin.settings'] } };
    expect(canViewPurchaseOrdersNav(user)).toBe(true);
    expect(getVisibleNavItems(user).some((n) => n.href === '/purchase-orders')).toBe(true);
  });

  it('shows Purchase Orders nav for Procurement with po.create via role', () => {
    const user = { permissions: [], role: { permissions: ['po.create', 'items.create'] } };
    expect(getVisibleNavItems(user).some((n) => n.href === '/purchase-orders')).toBe(true);
  });

  it('shows Purchase Orders nav for Project Manager with po.approve.pm via role', () => {
    const user = {
      permissions: [],
      role: { permissions: ['pr.approve.pm', 'po.approve.pm'] },
    };
    expect(getVisibleNavItems(user).some((n) => n.href === '/purchase-orders')).toBe(true);
  });

  it('shows Create PO action when PR is Created in SAP and user has po.create', () => {
    const pr = { status: 'Created in SAP', sapPRDocEntry: 42 };
    const user = { permissions: [], role: { permissions: ['po.create'] } };
    expect(canShowCreatePoAction(user, pr, { poReady: true })).toBe(true);
  });

  it('hides Create PO action without po.create or view.all', () => {
    const pr = { status: 'Created in SAP', sapPRDocEntry: 42 };
    const user = { permissions: [], role: { permissions: ['pr.create'] } };
    expect(canShowCreatePoAction(user, pr, { poReady: true })).toBe(false);
  });

  it('requires sapPRDocEntry for PO creation eligibility', () => {
    expect(isPrEligibleForPoCreation({ status: 'Created in SAP', sapPRDocEntry: 1 })).toBe(
      true,
    );
    expect(isPrEligibleForPoCreation({ status: 'Approved', sapPRDocEntry: null })).toBe(false);
  });

  it('allows SAP retry for finance approver and admins only', () => {
    const finance = { permissions: [], role: { permissions: ['po.approve.finance'] } };
    const pm = { permissions: [], role: { permissions: ['po.approve.pm'] } };
    const admin = { permissions: ['admin.settings'] };
    const viewAll = { permissions: ['view.all'] };
    expect(canRetrySapPurchaseOrder(finance)).toBe(true);
    expect(canRetrySapPurchaseOrder(admin)).toBe(true);
    expect(canRetrySapPurchaseOrder(viewAll)).toBe(true);
    expect(canRetrySapPurchaseOrder(pm)).toBe(false);
  });
});
