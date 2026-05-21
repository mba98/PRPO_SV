/**
 * Standard API response envelope helpers.
 */

export function successResponse(data, pagination) {
  const body = { success: true, data };
  if (pagination) {
    body.pagination = pagination;
  }
  return body;
}

export function failureResponse(message, error, code) {
  const body = { success: false, message };
  if (error !== undefined) {
    body.error = error;
  }
  if (code) {
    body.code = code;
  }
  return body;
}

export function validationFailureResponse(errors) {
  return {
    success: false,
    message: 'Validation failed',
    errors,
  };
}

export function conflictResponse() {
  return {
    success: false,
    message: 'Document changed, please reload',
  };
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

/**
 * Parse list query params from a Request URL.
 */
export function parseListQuery(request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || String(DEFAULT_PAGE), 10) || DEFAULT_PAGE);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
  );
  const sort = searchParams.get('sort') || 'createdAt';
  const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc';
  const q = searchParams.get('q') || undefined;
  const status = searchParams.get('status') || undefined;
  const from = searchParams.get('from') || undefined;
  const to = searchParams.get('to') || undefined;

  return { page, limit, sort, order, q, status, from, to, searchParams };
}

export function buildPagination(page, limit, total) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { page, limit, total, totalPages };
}
