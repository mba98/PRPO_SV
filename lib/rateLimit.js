/**
 * In-memory login rate limiter: 5 attempts per 15 minutes per IP + username.
 */

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;

const loginAttempts = new Map();

function getEntry(key) {
  const entry = loginAttempts.get(key);
  if (!entry) {
    return null;
  }
  if (Date.now() - entry.windowStart > LOGIN_WINDOW_MS) {
    loginAttempts.delete(key);
    return null;
  }
  return entry;
}

export function buildLoginRateLimitKey(ip, username) {
  return `${ip}:${username.toLowerCase()}`;
}

/**
 * Returns true if the attempt is allowed, false if rate limited.
 */
export function checkLoginRateLimit(ip, username) {
  const key = buildLoginRateLimitKey(ip, username);
  const entry = getEntry(key);
  if (!entry) {
    return { allowed: true, remaining: LOGIN_MAX_ATTEMPTS };
  }
  if (entry.count >= LOGIN_MAX_ATTEMPTS) {
    const retryAfterMs = LOGIN_WINDOW_MS - (Date.now() - entry.windowStart);
    return { allowed: false, remaining: 0, retryAfterMs };
  }
  return { allowed: true, remaining: LOGIN_MAX_ATTEMPTS - entry.count };
}

export function recordFailedLoginAttempt(ip, username) {
  const key = buildLoginRateLimitKey(ip, username);
  const entry = getEntry(key);
  if (!entry) {
    loginAttempts.set(key, { count: 1, windowStart: Date.now() });
    return;
  }
  entry.count += 1;
}

export function clearLoginRateLimit(ip, username) {
  loginAttempts.delete(buildLoginRateLimitKey(ip, username));
}

/** Reset store — for tests only. */
export function resetLoginRateLimitStore() {
  loginAttempts.clear();
}
