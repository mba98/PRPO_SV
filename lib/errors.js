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

export function sapFailureResponse(message, errorCode, sapError) {
  const body = {
    success: false,
    message,
    error: errorCode,
  };
  if (sapError) {
    body.sapError = sapError;
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

import { parseListQuery as parseListQueryBase } from '@/lib/listQuery.js';

/**
 * Parse list query params from a Request URL.
 */
export function parseListQuery(request) {
  const parsed = parseListQueryBase(request);
  return {
    ...parsed,
    sort: parsed.sort || 'createdAt',
    searchParams: parsed.searchParams,
  };
}

export function buildPagination(page, limit, total) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { page, limit, total, totalPages };
}
