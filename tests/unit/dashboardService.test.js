import { beforeEach, describe, expect, it, vi } from 'vitest';

const counts = vi.hoisted(() => ({
  pr: 0,
  po: 0,
  apri: 0,
  sapLog: 0,
  emailLog: 0,
}));

function chainableLean(result = []) {
  const chain = {
    select: () => chain,
    sort: () => chain,
    limit: () => chain,
    populate: () => chain,
    lean: () => Promise.resolve(result),
  };
  return chain;
}

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(true) }));

vi.mock('@/models/PurchaseRequest.js', () => ({
  default: {
    countDocuments: vi.fn(() => Promise.resolve(counts.pr)),
    find: vi.fn(() => chainableLean([])),
    exists: vi.fn(() => Promise.resolve(null)),
  },
}));

vi.mock('@/models/PurchaseOrder.js', () => ({
  default: {
    countDocuments: vi.fn(() => Promise.resolve(counts.po)),
    find: vi.fn(() => chainableLean([])),
    exists: vi.fn(() => Promise.resolve(null)),
  },
}));

vi.mock('@/models/APReserveInvoice.js', () => ({
  default: {
    countDocuments: vi.fn(() => Promise.resolve(counts.apri)),
    find: vi.fn(() => chainableLean([])),
    exists: vi.fn(() => Promise.resolve(null)),
  },
}));

vi.mock('@/models/SapIntegrationLog.js', () => ({
  default: {
    countDocuments: vi.fn(() => Promise.resolve(counts.sapLog)),
    find: vi.fn(() => chainableLean([])),
  },
}));

vi.mock('@/models/EmailLog.js', () => ({
  default: {
    countDocuments: vi.fn(() => Promise.resolve(counts.emailLog)),
    find: vi.fn(() => chainableLean([])),
  },
}));

vi.mock('@/lib/purchaseRequestsService.js', () => ({
  buildPrPendingApprovalFilter: vi.fn().mockResolvedValue({ status: 'Pending Warehouse Approval' }),
  sanitizePr: (d) => d,
  sanitizePrListItem: (d) => ({ ...d, id: d.id || d._id }),
}));

vi.mock('@/lib/purchaseOrdersService.js', () => ({
  buildPoPendingApprovalFilter: vi.fn().mockResolvedValue({ status: 'Pending Project Manager Approval' }),
  sanitizePo: (d) => d,
  sanitizePoListItem: (d) => ({ ...d, id: d.id || d._id }),
}));

vi.mock('@/lib/apReserveInvoicesService.js', () => ({
  sanitizeApri: (d) => d,
  sanitizeApriListItem: (d) => ({ ...d, id: d.id || d._id }),
}));

import { getDashboardSummary, getDashboardRecent } from '@/lib/dashboardService';

describe('dashboardService', () => {
  beforeEach(() => {
    counts.pr = 10;
    counts.po = 5;
    counts.apri = 2;
    counts.sapLog = 1;
    counts.emailLog = 3;
  });

  it('returns summary counts for admin', async () => {
    const user = { _id: 'u1', permissions: ['view.all'] };
    const summary = await getDashboardSummary(user);
    expect(summary.prs.total).toBe(10);
    expect(summary.pos.total).toBe(5);
    expect(summary.apri.total).toBe(2);
    expect(summary.sap.failedIntegrations).toBe(1);
    expect(summary.email.failedEmails).toBe(3);
  });

  it('scopes summary for requester-only user', async () => {
    counts.pr = 2;
    const user = { _id: 'u1', permissions: ['pr.create'] };
    const summary = await getDashboardSummary(user);
    expect(summary.prs.total).toBe(2);
    expect(summary.email.failedEmails).toBe(0);
  });

  it('returns recent records structure', async () => {
    const user = { _id: 'u1', permissions: ['view.all'] };
    const recent = await getDashboardRecent(user, { limit: 3 });
    expect(recent).toHaveProperty('purchaseRequests');
    expect(recent).toHaveProperty('sapFailures');
  });
});
