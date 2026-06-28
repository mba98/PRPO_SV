import https from 'node:https';
import http from 'node:http';
import fs from 'node:fs';
import { getSapErrorMessage, toSapRequestError } from '@/lib/sap/sapErrors.js';

const SAP_SL_BASE_URL = process.env.SAP_SL_BASE_URL;
const SAP_SL_USERNAME = process.env.SAP_SL_USERNAME;
const SAP_SL_PASSWORD = process.env.SAP_SL_PASSWORD;
const SAP_SL_COMPANY_DB = process.env.SAP_SL_COMPANY_DB;

let sessionCookie = null;
let httpsAgent;

function getBaseUrl() {
  if (!SAP_SL_BASE_URL) {
    throw sapLoginError('SAP_SL_BASE_URL is not configured');
  }
  return SAP_SL_BASE_URL.replace(/\/$/, '');
}

/**
 * Tag connection/login problems with a stable code so the API layer can map
 * them to a clean SAP_LOGIN_FAILED response without leaking internals.
 */
function sapLoginError(message, status) {
  const err = new Error(message);
  err.code = 'SAP_LOGIN_FAILED';
  if (status) err.status = status;
  return err;
}

/**
 * Only the host (no credentials, cookies, or session ids) is ever derived here.
 */
export function safeHost() {
  if (!SAP_SL_BASE_URL) return '(unset)';
  try {
    return new URL(SAP_SL_BASE_URL).host;
  } catch {
    return '(invalid)';
  }
}

export function getSapConfig() {
  return {
    host: safeHost(),
    companyDb: SAP_SL_COMPANY_DB || null,
    configured: Boolean(
      SAP_SL_BASE_URL && SAP_SL_USERNAME && SAP_SL_PASSWORD && SAP_SL_COMPANY_DB,
    ),
  };
}

/**
 * Safe, opt-in debug log (set SAP_DEBUG=true). Shows host, company DB, endpoint,
 * status, and duration only. Never logs password, cookie, session id, or body.
 */
function sapDebug(event, extra = {}) {
  if (process.env.SAP_DEBUG !== 'true') return;
  console.info('[sap-sl]', event, {
    host: safeHost(),
    companyDB: SAP_SL_COMPANY_DB || '(unset)',
    ...extra,
  });
}

/**
 * HTTPS agent for the Service Layer connection. SAP B1 Service Layer commonly
 * ships with a self-signed certificate on the internal HANA host; support that
 * via SAP_SL_CA_CERT (preferred, pin the cert) or SAP_SL_INSECURE_TLS=true.
 * Defaults to standard certificate verification.
 */
function getHttpsAgent() {
  if (httpsAgent !== undefined) return httpsAgent;
  const options = { keepAlive: true };
  const caPath = process.env.SAP_SL_CA_CERT;
  if (caPath) {
    try {
      options.ca = fs.readFileSync(caPath);
    } catch (err) {
      console.error('[sap-sl] failed to read SAP_SL_CA_CERT:', err.message);
    }
  }
  if (process.env.SAP_SL_INSECURE_TLS === 'true') {
    options.rejectUnauthorized = false;
  }
  httpsAgent = new https.Agent(options);
  return httpsAgent;
}

/**
 * Collect the name=value of every Set-Cookie header (SAP returns B1SESSION and,
 * on load-balanced setups, ROUTEID — both are needed for follow-up requests).
 */
export function extractCookies(setCookie) {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  return list
    .map((c) => c.split(';')[0])
    .filter(Boolean)
    .join('; ');
}

/**
 * Low-level request using node:https / node:http so we control TLS behaviour
 * (global fetch cannot trust a per-connection self-signed cert). Resolves with
 * a plain { status, ok, headers, text } object.
 */
function rawRequest(url, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(url);
    } catch {
      reject(new Error('Invalid SAP Service Layer URL'));
      return;
    }
    const isHttps = u.protocol === 'https:';
    const lib = isHttps ? https : http;
    const req = lib.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (isHttps ? 443 : 80),
        path: u.pathname + u.search,
        method,
        headers,
        agent: isHttps ? getHttpsAgent() : undefined,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            ok: res.statusCode >= 200 && res.statusCode < 300,
            headers: res.headers,
            text: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function normalizePath(endpoint) {
  return endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
}

function buildAuthHeaders(extra = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...extra,
  };
  if (sessionCookie) {
    headers.Cookie = sessionCookie;
  }
  return headers;
}

/**
 * Login to SAP Service Layer and store the session cookie(s) in memory.
 */
export async function login() {
  if (!SAP_SL_BASE_URL || !SAP_SL_USERNAME || !SAP_SL_PASSWORD || !SAP_SL_COMPANY_DB) {
    throw sapLoginError('SAP Service Layer environment variables are incomplete');
  }

  const start = Date.now();
  let response;
  try {
    response = await rawRequest(`${getBaseUrl()}/Login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        CompanyDB: SAP_SL_COMPANY_DB,
        UserName: SAP_SL_USERNAME,
        Password: SAP_SL_PASSWORD,
      }),
    });
  } catch (err) {
    sapDebug('login transport error', {
      method: 'POST',
      endpoint: '/Login',
      error: err.code || err.message,
      durationMs: Date.now() - start,
    });
    throw sapLoginError(`SAP Service Layer login transport error: ${err.code || err.message}`);
  }

  sapDebug('login response', {
    method: 'POST',
    endpoint: '/Login',
    status: response.status,
    durationMs: Date.now() - start,
  });

  if (!response.ok) {
    let parsed = null;
    try {
      parsed = response.text ? JSON.parse(response.text) : null;
    } catch {
      parsed = null;
    }
    throw sapLoginError(
      `SAP Service Layer login failed: ${response.status} ${getSapErrorMessage({ responseBody: parsed, status: response.status })}`,
      response.status,
    );
  }

  sessionCookie = extractCookies(response.headers['set-cookie']);
  return true;
}

/**
 * Raw authenticated HTTP call with a single 401 retry after re-login.
 */
export async function request(method, endpoint, body, { _retried = false } = {}) {
  if (!sessionCookie) {
    await login();
  }

  const path = normalizePath(endpoint);
  const url = `${getBaseUrl()}${path}`;
  const headers = buildAuthHeaders();
  const bodyStr = body != null ? JSON.stringify(body) : undefined;
  const start = Date.now();

  let response = await rawRequest(url, {
    method,
    headers,
    body: bodyStr,
  });

  sapDebug('request', {
    method,
    endpoint: path,
    status: response.status,
    durationMs: Date.now() - start,
  });

  if (response.status === 401 && !_retried) {
    clearSession();
    await login();
    const retryStart = Date.now();
    response = await rawRequest(url, {
      method,
      headers: buildAuthHeaders(),
      body: bodyStr,
    });
    sapDebug('request retry', {
      method,
      endpoint: path,
      status: response.status,
      durationMs: Date.now() - retryStart,
    });
  }

  return response;
}

function parseResponseJson(response) {
  const text = response.text;
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * JSON Service Layer call; throws on non-2xx with responseBody attached.
 */
export async function slFetch(endpoint, { method = 'GET', body } = {}) {
  const payload = body != null && typeof body === 'object' ? body : body;
  const response = await request(
    method,
    endpoint,
    payload != null && method !== 'GET' ? payload : undefined,
  );
  const data = parseResponseJson(response);
  if (!response.ok) {
    throw toSapRequestError(response, data);
  }
  return data;
}

export async function get(endpoint) {
  return slFetch(endpoint, { method: 'GET' });
}

export async function post(endpoint, body) {
  return slFetch(endpoint, { method: 'POST', body });
}

export async function patch(endpoint, body) {
  return slFetch(endpoint, { method: 'PATCH', body });
}

export async function getItem(itemCode) {
  const encoded = encodeURIComponent(itemCode.replace(/'/g, "''"));
  return get(`/Items('${encoded}')`);
}

export async function createItem(payload) {
  return post('/Items', payload);
}

export async function createPR(payload) {
  return post('/PurchaseRequests', payload);
}

export async function createPO(payload) {
  return post('/PurchaseOrders', payload);
}

export async function getPurchaseRequest(docEntry) {
  return get(`/PurchaseRequests(${docEntry})`);
}

export async function patchPurchaseRequest(docEntry, payload) {
  return patch(`/PurchaseRequests(${docEntry})`, payload);
}

export async function closePurchaseRequest(docEntry) {
  return post(`/PurchaseRequests(${docEntry})/Close`, {});
}

export async function createAPReserveInvoice(payload) {
  return post('/PurchaseInvoices', payload);
}

export async function getVendors() {
  return get("/BusinessPartners?$filter=CardType eq 'cSupplier'");
}

export async function getBusinessPartner(cardCode) {
  const encoded = encodeURIComponent(String(cardCode).replace(/'/g, "''"));
  const expand = '$expand=BPCurrenciesCollection';
  const select = '$select=CardCode,CardName,Currency';
  try {
    return await get(`/BusinessPartners('${encoded}')?${select}&${expand}`);
  } catch (err) {
    return get(`/BusinessPartners('${encoded}')?${select}`);
  }
}

export async function getWarehouses() {
  return get('/Warehouses');
}

export async function getProjects() {
  return get('/Projects');
}

export async function getCostCenters() {
  return get('/DistributionRules');
}

/**
 * Health / connection probe: login and return safe metadata (no credentials).
 */
export async function probeServiceLayer() {
  const config = getSapConfig();
  if (!config.configured) {
    throw new Error('SAP Service Layer environment variables are incomplete');
  }
  const start = Date.now();
  await login();
  return {
    companyDb: SAP_SL_COMPANY_DB,
    host: safeHost(),
    serviceLayerReachable: true,
    latencyMs: Date.now() - start,
  };
}

/**
 * @deprecated Use probeServiceLayer for richer health data.
 */
export async function pingServiceLayer() {
  const result = await probeServiceLayer();
  return result.serviceLayerReachable === true;
}

export function getSessionCookie() {
  return sessionCookie;
}

export function hasSession() {
  return Boolean(sessionCookie);
}

export function clearSession() {
  sessionCookie = null;
}
