import { describe, expect, it, vi } from 'vitest';
import { sapLookupFailureResponse } from '@/lib/sapLookupApi';

describe('sapLookupApi', () => {
  it('returns user-friendly message without raw ODBC text', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = sapLookupFailureResponse('test', new Error('[odbc] secret detail'), 'Failed to search SAP items');
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toBe('Failed to search SAP items');
    expect(body.message).not.toContain('odbc');
    expect(body.error).toBe('SAP_LOOKUP_FAILED');
    consoleSpy.mockRestore();
  });

  it('maps missing HANA config to HANA_UNAVAILABLE', async () => {
    const res = sapLookupFailureResponse(
      'test',
      new Error('HANA_CONNECTION_STRING is not configured'),
      'Failed to search SAP items',
    );
    const body = await res.json();
    expect(body.error).toBe('HANA_UNAVAILABLE');
  });

  it('maps a tagged SAP login failure to SAP_LOGIN_FAILED', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('SAP Service Layer login transport error: DEPTH_ZERO_SELF_SIGNED_CERT');
    err.code = 'SAP_LOGIN_FAILED';
    const res = sapLookupFailureResponse('sap/warehouses', err, 'Failed to load warehouses');
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.success).toBe(false);
    expect(body.message).toBe('Failed to connect to SAP Service Layer');
    expect(body.error).toBe('SAP_LOGIN_FAILED');
    expect(body.message).not.toContain('CERT');
    consoleSpy.mockRestore();
  });

  it('maps TLS errors to SAP_TLS_ERROR', async () => {
    const err = new Error('SAP TLS certificate validation failed');
    err.code = 'SAP_TLS_ERROR';
    const res = sapLookupFailureResponse('sap/vendors', err, 'Failed to load vendors');
    const body = await res.json();
    expect(body.error).toBe('SAP_TLS_ERROR');
    expect(body.message).toContain('SAP_SL_CA_CERT');
  });

  it('returns SAP_LOOKUP_FAILED for an authenticated lookup error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = sapLookupFailureResponse(
      'sap/warehouses',
      new Error('Warehouses request failed'),
      'Failed to load warehouses',
    );
    const body = await res.json();
    expect(body.error).toBe('SAP_LOOKUP_FAILED');
    expect(body.message).toBe('Failed to load warehouses');
    consoleSpy.mockRestore();
  });
});
