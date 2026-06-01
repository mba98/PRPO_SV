import { describe, expect, it } from 'vitest';
import {
  parseSapError,
  getSapErrorMessage,
  getSapErrorCode,
  sanitizeSapError,
  sanitizeSapErrorText,
  toSapRequestError,
} from '@/lib/sap/sapErrors.js';

const SECRET_COOKIE = 'B1SESSION=abc123; ROUTEID=node1';

describe('sapErrors', () => {
  it('parses Service Layer error shape', () => {
    const parsed = parseSapError({
      status: 400,
      responseBody: {
        error: {
          code: -5002,
          message: { value: 'Invalid item code' },
        },
      },
    });
    expect(parsed.code).toBe('-5002');
    expect(parsed.message).toBe('Invalid item code');
    expect(parsed.status).toBe(400);
  });

  it('handles network errors', () => {
    const parsed = parseSapError({ code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND sap.local' });
    expect(parsed.code).toBe('SAP_NETWORK_ERROR');
    expect(parsed.message).toContain('Cannot resolve');
  });

  it('handles TLS self-signed errors with actionable message', () => {
    const parsed = parseSapError({
      code: 'DEPTH_ZERO_SELF_SIGNED_CERT',
      message: 'self signed certificate',
    });
    expect(parsed.code).toBe('SAP_TLS_ERROR');
    expect(parsed.message).toContain('SAP_SL_CA_CERT');
  });

  it('does not leak cookies or passwords', () => {
    const text = sanitizeSapErrorText(`Login failed ${SECRET_COOKIE} password=secret`);
    expect(text).not.toContain('abc123');
    expect(text).not.toContain('secret');
    expect(text.toLowerCase()).not.toContain('b1session=');
  });

  it('getSapErrorMessage and getSapErrorCode read parsed values', () => {
    const err = {
      responseBody: { error: { code: '42', message: { value: 'Company mismatch' } } },
    };
    expect(getSapErrorMessage(err)).toBe('Company mismatch');
    expect(getSapErrorCode(err)).toBe('42');
  });

  it('sanitizeSapError returns safe envelope', () => {
    const safe = sanitizeSapError({
      responseBody: { error: { message: { value: 'OK' } } },
    });
    expect(safe).toEqual(expect.objectContaining({ message: 'OK' }));
    expect(JSON.stringify(safe)).not.toContain('B1SESSION');
  });

  it('toSapRequestError builds Error from SAP response without TDZ', () => {
    const err = toSapRequestError(
      { status: 400 },
      { error: { code: -5002, message: { value: 'Invalid warehouse' } } },
    );
    expect(err.message).toBe('Invalid warehouse');
    expect(err.code).toBe('-5002');
    expect(err.status).toBe(400);
    expect(err.responseBody.error.message.value).toBe('Invalid warehouse');
  });
});
