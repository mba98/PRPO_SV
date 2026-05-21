import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkAllDependencies } from '@/lib/health';

vi.mock('@/lib/mongodb', () => ({
  pingMongo: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/sapServiceLayer', () => ({
  pingServiceLayer: vi.fn().mockResolvedValue(true),
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
});
