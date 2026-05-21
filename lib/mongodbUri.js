/**
 * MongoDB URI validation and safe logging (never exposes credentials).
 * Uses WHATWG URL-style parsing via regex — not deprecated url.parse().
 */

const VALID_SCHEMES = new Set(['mongodb', 'mongodb+srv']);

/**
 * Fix common typo: mmongodb+srv -> mongodb+srv
 */
export function normalizeMongoUri(uri) {
  const trimmed = uri.trim();
  if (/^mmongodb\+srv:\/\//i.test(trimmed)) {
    return trimmed.replace(/^mmongodb\+srv:\/\//i, 'mongodb+srv://');
  }
  if (/^mmongodb:\/\//i.test(trimmed)) {
    return trimmed.replace(/^mmongodb:\/\//i, 'mongodb://');
  }
  return trimmed;
}

/**
 * Extract scheme and host(s) for diagnostics — no username/password.
 */
export function summarizeMongoUri(uri) {
  const normalized = normalizeMongoUri(uri);
  const schemeMatch = normalized.match(/^([a-z+]+):\/\//i);
  const scheme = schemeMatch ? schemeMatch[1].toLowerCase() : null;

  if (/^mmongodb/i.test(uri.trim())) {
    return {
      ok: false,
      issue: 'invalid_scheme',
      scheme: 'mmongodb (typo)',
      hosts: null,
      isSrv: false,
      message: 'URI starts with "mmongodb" — use "mongodb" or "mongodb+srv" only.',
    };
  }

  if (!scheme || !VALID_SCHEMES.has(scheme)) {
    return {
      ok: false,
      issue: 'invalid_scheme',
      scheme: scheme || 'missing',
      hosts: null,
      isSrv: false,
      message: `URI scheme must be "mongodb" or "mongodb+srv", got "${scheme || 'none'}".`,
    };
  }

  const withoutScheme = normalized.replace(/^mongodb\+srv:\/\//i, '').replace(/^mongodb:\/\//i, '');
  const atIndex = withoutScheme.lastIndexOf('@');
  const hostAndRest = atIndex >= 0 ? withoutScheme.slice(atIndex + 1) : withoutScheme;
  const hosts = hostAndRest.split('/')[0].split('?')[0];

  if (!hosts) {
    return {
      ok: false,
      issue: 'missing_host',
      scheme,
      hosts: null,
      isSrv: scheme === 'mongodb+srv',
      message: 'URI is missing a host name.',
    };
  }

  return {
    ok: true,
    issue: null,
    scheme,
    hosts,
    isSrv: scheme === 'mongodb+srv',
    message: null,
  };
}

export function validateMongoUri(uri) {
  const summary = summarizeMongoUri(uri);
  if (!summary.ok) {
    const err = new Error(summary.message);
    err.code = summary.issue;
    throw err;
  }
  return summary;
}

/**
 * Map driver errors to actionable hints (Atlas / Windows / Node).
 */
export function getMongoConnectionHint(error) {
  const msg = `${error?.message || ''} ${error?.reason || ''}`.toLowerCase();
  const code = error?.code;

  if (msg.includes('mmongodb') || msg.includes('invalid_scheme')) {
    return 'Fix MONGODB_URI scheme: use mongodb:// or mongodb+srv:// (not mmongodb).';
  }

  if (
    msg.includes('querysrv') ||
    msg.includes('enotfound') && msg.includes('_mongodb._tcp') ||
    code === 'ECONNREFUSED' && msg.includes('srv')
  ) {
    return [
      'SRV DNS lookup failed from Node (querySrv ECONNREFUSED).',
      'Try the non-SRV mongodb:// host list in .env.local.example (tls=true, replicaSet=...).',
      'PowerShell nslookup can succeed while Node DNS still fails — common on Windows Server.',
      'Install Node.js 20 LTS (recommended) instead of Node 24 if issues persist.',
    ].join(' ');
  }

  if (msg.includes('server selection timed out') || msg.includes('serverselectiontimeoutms')) {
    return [
      'Server selection timed out.',
      'In MongoDB Atlas → Network Access: add this server\'s public IP (or 0.0.0.0/0 for testing only).',
      'Confirm Database Access user/password; URL-encode special characters in the password.',
      'If mongodb+srv fails, switch to the non-SRV connection string from Atlas (Connect → Drivers).',
    ].join(' ');
  }

  if (
    msg.includes('authentication failed') ||
    msg.includes('bad auth') ||
    msg.includes('auth failed') ||
    code === 18
  ) {
    return [
      'Authentication failed.',
      'Verify Atlas Database Access username/password.',
      'If the password contains @ : / ? # encode it for the URI or reset the password.',
    ].join(' ');
  }

  if (msg.includes('ip') && (msg.includes('whitelist') || msg.includes('not authorized'))) {
    return 'Atlas rejected the connection: add the server public IP under Network Access → IP Access List.';
  }

  if (msg.includes('econnrefused') && !msg.includes('srv')) {
    return 'TCP connection refused. Check hostnames, port 27017, firewall, and Atlas Network Access.';
  }

  return 'See .env.local.example for SRV and non-SRV Atlas URI formats. Run: npm run db:check';
}

export function formatMongoConnectionError(error) {
  const hint = getMongoConnectionHint(error);
  const lines = [`MongoDB connection failed: ${error.message}`];
  if (hint) {
    lines.push(`Hint: ${hint}`);
  }
  return lines.join('\n');
}
