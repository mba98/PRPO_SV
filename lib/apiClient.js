/**
 * Client-side API fetch with standard envelope handling.
 * Dev: logs source label and dedupes identical in-flight GET requests.
 */
const inFlightGet = new Map();

export async function apiFetch(url, options = {}) {
  const source = options.source || 'unknown';
  const method = (options.method || 'GET').toUpperCase();
  const dedupe = options.dedupe !== false && method === 'GET';

  if (process.env.NODE_ENV === 'development') {
    console.log('[fetch]', method, url, 'source:', source);
  }

  const dedupeKey = dedupe ? `${method}:${url}` : null;
  if (dedupeKey && inFlightGet.has(dedupeKey)) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[fetch-dedupe]', url, 'source:', source);
    }
    return inFlightGet.get(dedupeKey);
  }

  const run = async () => {
    try {
      const res = await fetch(url, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
        ...options,
      });

      const text = await res.text();
      let json;
      try {
        json = text ? JSON.parse(text) : { success: false, message: 'Empty response from server' };
      } catch {
        json = {
          success: false,
          message: res.ok
            ? 'Invalid response from server'
            : `Request failed (${res.status || 'unknown'})`,
        };
      }

      if (!res.ok && json.success !== false) {
        json = {
          ...json,
          success: false,
          message: json.message || `Request failed (${res.status})`,
        };
      }

      return { ok: res.ok, status: res.status, json };
    } catch (err) {
      const message =
        err?.message === 'Failed to fetch'
          ? 'Network error — check your connection and try again'
          : err?.message || 'Network request failed';
      return {
        ok: false,
        status: 0,
        json: { success: false, message },
      };
    }
  };

  const promise = run();
  if (dedupeKey) {
    inFlightGet.set(dedupeKey, promise);
    promise.finally(() => {
      inFlightGet.delete(dedupeKey);
    });
  }

  return promise;
}
