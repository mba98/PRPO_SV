/**
 * URL query helpers for list pages — avoid router loops by skipping identical navigations.
 */

export function queryStringFromParams(params) {
  if (params instanceof URLSearchParams) {
    return params.toString();
  }
  return new URLSearchParams(params).toString();
}

function readCurrentQueryString() {
  if (typeof window === 'undefined') return null;
  return window.location.search.startsWith('?')
    ? window.location.search.slice(1)
    : window.location.search;
}

/**
 * Push or replace only when the query string would change (client-side compare).
 * @param {object} [options]
 * @param {boolean} [options.replace]
 * @param {string} [options.currentQuery] — override for tests; omit to read from window.location
 */
export function navigateWithQuery(router, pathname, params, { replace = false, currentQuery } = {}) {
  const next = queryStringFromParams(params);
  const current = currentQuery !== undefined ? currentQuery : readCurrentQueryString();
  if (current !== null && next === current) return;

  const url = next ? `${pathname}?${next}` : pathname;
  if (replace) {
    router.replace(url, { scroll: false });
  } else {
    router.push(url);
  }
}
