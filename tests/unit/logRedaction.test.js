import { describe, expect, it } from 'vitest';
import { redactSecretsFromText, redactSecretsFromObject } from '@/lib/logRedaction';

describe('logRedaction', () => {
  it('redacts inline passwords from text', () => {
    const out = redactSecretsFromText('SMTP password=secret123 failed');
    expect(out).not.toContain('secret123');
    expect(out).toContain('[redacted]');
  });

  it('redacts sensitive object keys', () => {
    const out = redactSecretsFromObject({
      B1SESSION: 'abc',
      host: 'sap.example.com',
      nested: { password: 'x' },
    });
    expect(out.B1SESSION).toBe('[redacted]');
    expect(out.host).toBe('sap.example.com');
    expect(out.nested.password).toBe('[redacted]');
  });

  it('does not expose cookie values in nested strings', () => {
    const out = redactSecretsFromText('token=abc123-def');
    expect(out).toContain('[redacted]');
  });
});
