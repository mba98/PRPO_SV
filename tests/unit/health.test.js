import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkAllDependencies } from '@/lib/health';

vi.mock('@/lib/mongodb', () => ({
  pingMongo: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/sapServiceLayer', () => ({
  probeServiceLayer: vi.fn().mockResolvedValue({
    companyDb: 'TEST_DB',
    host: 'sap.internal:50000',
    serviceLayerReachable: true,
    latencyMs: 12,
  }),
  getSapConfig: vi.fn(() => ({ host: 'sap.internal:50000', companyDb: 'TEST_DB', configured: true })),
}));

vi.mock('@/lib/sapHana', () => ({
  pingHana: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/s3', () => ({
  pingS3: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/email', () => ({
  pingSmtp: vi.fn().mockResolvedValue(true),
}));

describe('checkAllDependencies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success when all probes are up', async () => {
    const result = await checkAllDependencies();
    expect(result.success).toBe(true);
    expect(result.dependencies.mongo.status).toBe('up');
    expect(result.dependencies.sap.status).toBe('up');
    expect(result.dependencies.sap.companyDb).toBe('TEST_DB');
    expect(result.dependencies.sap.host).toBe('sap.internal:50000');
    expect(result.dependencies.hana.status).toBe('up');
    expect(result.dependencies.s3.status).toBe('up');
    expect(result.dependencies.smtp.status).toBe('up');
    expect(result.checkedAt).toBeDefined();
  });

  it('returns failure when a probe is down', async () => {
    const { pingMongo } = await import('@/lib/mongodb');
    pingMongo.mockRejectedValueOnce(new Error('Connection refused'));

    const result = await checkAllDependencies();
    expect(result.success).toBe(false);
    expect(result.dependencies.mongo.status).toBe('down');
    expect(result.dependencies.mongo.error).toContain('Connection refused');
  });

  it('returns safe SAP error without secrets when probe fails', async () => {
    const { probeServiceLayer } = await import('@/lib/sapServiceLayer');
    probeServiceLayer.mockRejectedValueOnce(
      Object.assign(new Error('SAP login failed'), { code: 'SAP_LOGIN_FAILED' }),
    );

    const result = await checkAllDependencies();
    expect(result.dependencies.sap.status).toBe('down');
    expect(result.dependencies.sap.error).toContain('login failed');
    expect(JSON.stringify(result.dependencies.sap)).not.toMatch(/password|B1SESSION/i);
  });
});
