/**
 * Client-side API fetch with standard envelope handling.
 * Never throws on network or JSON parse failures — returns a failed envelope instead.
 */
export async function apiFetch(url, options = {}) {
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
}
