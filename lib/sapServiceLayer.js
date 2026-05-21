const SAP_SL_BASE_URL = process.env.SAP_SL_BASE_URL;
const SAP_SL_USERNAME = process.env.SAP_SL_USERNAME;
const SAP_SL_PASSWORD = process.env.SAP_SL_PASSWORD;
const SAP_SL_COMPANY_DB = process.env.SAP_SL_COMPANY_DB;

let sessionCookie = null;

function getBaseUrl() {
  if (!SAP_SL_BASE_URL) {
    throw new Error('SAP_SL_BASE_URL is not configured');
  }
  return SAP_SL_BASE_URL.replace(/\/$/, '');
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
 * Login to SAP Service Layer and store session cookie in memory.
 */
export async function login() {
  const response = await fetch(`${getBaseUrl()}/Login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      CompanyDB: SAP_SL_COMPANY_DB,
      UserName: SAP_SL_USERNAME,
      Password: SAP_SL_PASSWORD,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`SAP Service Layer login failed: ${response.status} ${parseSapError(body)}`);
  }

  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    sessionCookie = setCookie.split(';')[0];
  }

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

  let response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    clearSession();
    await login();
    headers.Cookie = sessionCookie;
    response = await fetch(url, { ...options, headers });
  }

  return response;
}

export async function slFetch(path, options = {}) {
  const response = await request(path, options);
  const text = await response.text();
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
