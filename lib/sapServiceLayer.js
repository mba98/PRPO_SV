import https from 'node:https';
import http from 'node:http';
import fs from 'node:fs';

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
function safeHost() {
  if (!SAP_SL_BASE_URL) return '(unset)';
  try {
    return new URL(SAP_SL_BASE_URL).host;
  } catch {
    return '(invalid)';
  }
}

/**
 * Safe, opt-in debug log (set SAP_DEBUG=true). Shows host, company DB, endpoint
 * and HTTP status only. Never logs password, cookie, or session id.
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
 * Accepts the node:http array form or a single string.
 */
function extractCookies(setCookie) {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  return list
    .map((c) => c.split(';')[0])
    .filter(Boolean)
    .join('; ');
}

function parseSapError(body) {
  try {
    const parsed = typeof body === 'string' ? JSON.parse(body) : body;
    return parsed?.error?.message?.value || 'SAP Service Layer request failed';
  } catch {
    return 'SAP Service Layer request failed';
  }
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

/**
 * Login to SAP Service Layer and store the session cookie(s) in memory.
 */
export async function login() {
  if (!SAP_SL_BASE_URL || !SAP_SL_USERNAME || !SAP_SL_PASSWORD || !SAP_SL_COMPANY_DB) {
    throw sapLoginError('SAP Service Layer environment variables are incomplete');
  }

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
    sapDebug('login transport error', { endpoint: '/Login', error: err.code || err.message });
    throw sapLoginError(`SAP Service Layer login transport error: ${err.code || err.message}`);
  }

  sapDebug('login response', { endpoint: '/Login', status: response.status });

  if (!response.ok) {
    throw sapLoginError(
      `SAP Service Layer login failed: ${response.status} ${parseSapError(response.text)}`,
      response.status,
    );
  }

  sessionCookie = extractCookies(response.headers['set-cookie']);
  return true;
}

/**
 * Authenticated request with single 401 retry after re-login.
 */
export async function request(path, options = {}) {
  if (!sessionCookie) {
    await login();
  }

  const url = `${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (sessionCookie) {
    headers.Cookie = sessionCookie;
  }

  let response = await rawRequest(url, { ...options, headers });
  sapDebug('request', { endpoint: path, status: response.status });

  if (response.status === 401) {
    clearSession();
    await login();
    headers.Cookie = sessionCookie;
    response = await rawRequest(url, { ...options, headers });
    sapDebug('request retry', { endpoint: path, status: response.status });
  }

  return response;
}

export async function slFetch(path, options = {}) {
  const response = await request(path, options);
  const text = response.text;
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!response.ok) {
    const message = parseSapError(data || text);
    const err = new Error(message);
    err.status = response.status;
    err.responseBody = data;
    throw err;
  }
  return data;
}

export async function getItem(itemCode) {
  const encoded = encodeURIComponent(itemCode.replace(/'/g, "''"));
  return slFetch(`/Items('${encoded}')`);
}

export async function createItem(payload) {
  return slFetch('/Items', { method: 'POST', body: JSON.stringify(payload) });
}

export async function createPR(payload) {
  return slFetch('/PurchaseRequests', { method: 'POST', body: JSON.stringify(payload) });
}

export async function createPO(payload) {
  return slFetch('/PurchaseOrders', { method: 'POST', body: JSON.stringify(payload) });
}

export async function getPurchaseRequest(docEntry) {
  return slFetch(`/PurchaseRequests(${docEntry})`);
}

export async function patchPurchaseRequest(docEntry, payload) {
  return slFetch(`/PurchaseRequests(${docEntry})`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function closePurchaseRequest(docEntry) {
  return slFetch(`/PurchaseRequests(${docEntry})/Close`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function createAPReserveInvoice(payload) {
  return slFetch('/PurchaseInvoices', { method: 'POST', body: JSON.stringify(payload) });
}

export async function getVendors() {
  return slFetch('/BusinessPartners?$filter=CardType eq \'cSupplier\'');
}

export async function getWarehouses() {
  return slFetch('/Warehouses');
}

export async function getProjects() {
  return slFetch('/Projects');
}

export async function getCostCenters() {
  return slFetch('/DistributionRules');
}

/**
 * Health probe: attempt login and return success without exposing credentials.
 */
export async function pingServiceLayer() {
  if (!SAP_SL_BASE_URL || !SAP_SL_USERNAME || !SAP_SL_PASSWORD || !SAP_SL_COMPANY_DB) {
    throw new Error('SAP Service Layer environment variables are incomplete');
  }
  await login();
  return sessionCookie !== null;
}

export function getSessionCookie() {
  return sessionCookie;
}

export function clearSession() {
  sessionCookie = null;
}
