/**
 * Authenticated health check — does not print credentials.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadEnvLocal } from '../lib/loadEnvLocal.js';

function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadDotEnv();
  loadEnvLocal();

  const baseUrl = process.env.HEALTH_CHECK_URL || 'http://localhost:3000';
  const username = process.env.SEED_ADMIN_USERNAME?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error('SEED_ADMIN_USERNAME and SEED_ADMIN_PASSWORD must be set for authenticated health check.');
  }

  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!loginRes.ok) {
    throw new Error(`Login failed: HTTP ${loginRes.status}`);
  }

  const setCookie = loginRes.headers.getSetCookie?.() || [];
  const cookieHeader = setCookie.map((c) => c.split(';')[0]).join('; ');
  if (!cookieHeader) {
    throw new Error('Login succeeded but no session cookie returned.');
  }

  const healthRes = await fetch(`${baseUrl}/api/health`, {
    headers: { cookie: cookieHeader },
  });
  const body = await healthRes.json();
  console.log(`GET /api/health: HTTP ${healthRes.status}`);
  console.log(`success: ${body?.success === true}`);
  if (body?.data?.dependencies) {
    for (const [name, dep] of Object.entries(body.data.dependencies)) {
      console.log(`${name}: ${dep.status}`);
    }
    console.log(`checkedAt: ${body.data.checkedAt}`);
  } else if (body?.message) {
    console.log(`message: ${body.message}`);
  }

  if (!healthRes.ok || body?.success !== true) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
