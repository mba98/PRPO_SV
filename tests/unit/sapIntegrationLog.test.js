import { describe, expect, it } from 'vitest';
import { sanitizeLogPayload } from '@/lib/sap/sapIntegrationLog.js';

describe('sapIntegrationLog', () => {
  it('redacts sensitive keys from payloads', () => {
    const sanitized = sanitizeLogPayload({
      CompanyDB: 'TEST',
      Password: 'secret',
      Cookie: 'B1SESSION=abc',
      nested: { authorization: 'Bearer x' },
    });
    expect(sanitized.Password).toBe('[redacted]');
    expect(sanitized.Cookie).toBe('[redacted]');
    expect(sanitized.nested.authorization).toBe('[redacted]');
    expect(sanitized.CompanyDB).toBe('TEST');
  });
});
