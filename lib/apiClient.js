/**
 * Client-side API fetch with standard envelope handling.
 */
export async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const json = await res.json();
  return { ok: res.ok, status: res.status, json };
}
