import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import https from 'node:https';

function createMockResponse({ status = 200, headers = {}, body = '{}' }) {
  const handlers = {};
  return {
    statusCode: status,
    headers,
    on(event, fn) {
      handlers[event] = fn;
    },
    emit(event, data) {
      if (handlers[event]) handlers[event](data);
    },
    finish() {
      if (handlers.data) handlers.data(Buffer.from(body));
      if (handlers.end) handlers.end();
    },
  };
}

describe('sapServiceLayer', () => {
  let requestMock;
  const envKeys = [
    'SAP_SL_BASE_URL',
    'SAP_SL_USERNAME',
    'SAP_SL_PASSWORD',
    'SAP_SL_COMPANY_DB',
  ];
  let savedEnv;

  beforeEach(() => {
    savedEnv = {};
    for (const k of envKeys) {
      savedEnv[k] = process.env[k];
      process.env[k] =
        k === 'SAP_SL_BASE_URL' ? 'https://sap.example.com:50000/b1s/v1' : `test-${k}`;
    }
    requestMock = vi.fn();
    https.request = requestMock;
    vi.resetModules();
  });

  afterEach(() => {
    for (const k of envKeys) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  });

  function queueResponse({ status = 200, headers = {}, body = '{}' }) {
    requestMock.mockImplementationOnce((opts, cb) => {
      const res = createMockResponse({ status, headers, body });
      const req = {
        write: vi.fn(),
        end: vi.fn(() => {
          cb(res);
          res.finish();
        }),
        on: vi.fn(),
      };
      return req;
    });
  }

  it('login stores B1SESSION and ROUTEID cookies', async () => {
    queueResponse({
      headers: {
        'set-cookie': ['B1SESSION=abc; Path=/', 'ROUTEID=.node1; Path=/'],
      },
      body: '{}',
    });

    const sl = await import('@/lib/sapServiceLayer.js');
    sl.clearSession();
    await sl.login();
    expect(sl.getSessionCookie()).toContain('B1SESSION=abc');
    expect(sl.getSessionCookie()).toContain('ROUTEID=.node1');
  });

  it('request auto-logins when no session', async () => {
    queueResponse({
      headers: { 'set-cookie': ['B1SESSION=s1; Path=/'] },
      body: '{}',
    });
    queueResponse({
      body: '{"value":[]}',
    });

    const sl = await import('@/lib/sapServiceLayer.js');
    sl.clearSession();
    const data = await sl.get('/Warehouses');
    expect(data).toEqual({ value: [] });
    expect(requestMock).toHaveBeenCalledTimes(2);
  });

  it('retries once after 401 session expiry', async () => {
    queueResponse({
      headers: { 'set-cookie': ['B1SESSION=s1; Path=/'] },
      body: '{}',
    });
    queueResponse({ status: 401, body: '{}' });
    queueResponse({
      headers: { 'set-cookie': ['B1SESSION=s2; Path=/'] },
      body: '{}',
    });
    queueResponse({ body: '{"ok":true}' });

    const sl = await import('@/lib/sapServiceLayer.js');
    sl.clearSession();
    const data = await sl.get('/Projects');
    expect(data.ok).toBe(true);
    expect(requestMock.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('does not retry more than once after repeated 401', async () => {
    queueResponse({
      headers: { 'set-cookie': ['B1SESSION=s1; Path=/'] },
      body: '{}',
    });
    queueResponse({ status: 401, body: '{}' });
    queueResponse({
      headers: { 'set-cookie': ['B1SESSION=s2; Path=/'] },
      body: '{}',
    });
    queueResponse({ status: 401, body: '{"error":{"message":{"value":"Unauthorized"}}}' });

    const sl = await import('@/lib/sapServiceLayer.js');
    sl.clearSession();
    await expect(sl.get('/Projects')).rejects.toThrow();
    expect(requestMock.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it('exports required integration functions', async () => {
    const sl = await import('@/lib/sapServiceLayer.js');
    expect(typeof sl.login).toBe('function');
    expect(typeof sl.request).toBe('function');
    expect(typeof sl.get).toBe('function');
    expect(typeof sl.post).toBe('function');
    expect(typeof sl.patch).toBe('function');
    expect(typeof sl.createPR).toBe('function');
    expect(typeof sl.createPO).toBe('function');
    expect(typeof sl.createAPReserveInvoice).toBe('function');
    expect(typeof sl.getPurchaseRequest).toBe('function');
    expect(typeof sl.patchPurchaseRequest).toBe('function');
    expect(typeof sl.closePurchaseRequest).toBe('function');
    expect(typeof sl.getVendors).toBe('function');
    expect(typeof sl.getWarehouses).toBe('function');
    expect(typeof sl.getProjects).toBe('function');
    expect(typeof sl.getCostCenters).toBe('function');
    expect(typeof sl.getItem).toBe('function');
    expect(typeof sl.createItem).toBe('function');
    expect(typeof sl.probeServiceLayer).toBe('function');
  });

  it('extractCookies joins B1SESSION and ROUTEID', async () => {
    const { extractCookies } = await import('@/lib/sapServiceLayer.js');
    const cookie = extractCookies(['B1SESSION=a; HttpOnly', 'ROUTEID=b; Path=/']);
    expect(cookie).toBe('B1SESSION=a; ROUTEID=b');
  });

  it('getSapConfig exposes host and companyDb without secrets', async () => {
    const { getSapConfig } = await import('@/lib/sapServiceLayer.js');
    const cfg = getSapConfig();
    expect(cfg.host).toBe('sap.example.com:50000');
    expect(cfg.companyDb).toBe('test-SAP_SL_COMPANY_DB');
    expect(cfg.configured).toBe(true);
    expect(JSON.stringify(cfg)).not.toMatch(/password/i);
  });
});
