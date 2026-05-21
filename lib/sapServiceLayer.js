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
    throw new Error(`SAP Service Layer login failed: ${response.status} ${body}`);
  }

  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    sessionCookie = setCookie.split(';')[0];
  }

  return true;
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
