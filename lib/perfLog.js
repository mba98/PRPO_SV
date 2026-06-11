const enabled =
  process.env.NODE_ENV === 'development' || process.env.PERF_LOG === '1';

export function isPerfLogEnabled() {
  return enabled;
}

export function perfStart(label) {
  if (!enabled) return null;
  const start = performance.now();
  return { label, start };
}

export function perfEnd(token, extra = '') {
  if (!enabled || !token) return;
  const ms = performance.now() - token.start;
  const suffix = extra ? ` ${extra}` : '';
  console.log(`[perf] ${token.label}: ${ms.toFixed(1)}ms${suffix}`);
}

export async function perfAsync(label, fn) {
  if (!enabled) return fn();
  const token = perfStart(label);
  try {
    return await fn();
  } finally {
    perfEnd(token);
  }
}
