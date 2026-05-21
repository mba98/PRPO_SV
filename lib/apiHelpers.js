import { NextResponse } from 'next/server';
import {
  conflictResponse,
  failureResponse,
  successResponse,
  validationFailureResponse,
} from '@/lib/errors';
import { formatZodErrors } from '@/lib/validators/common';

export function jsonSuccess(data, pagination, status = 200) {
  return NextResponse.json(successResponse(data, pagination), { status });
}

export function jsonError(message, error, status = 400) {
  return NextResponse.json(failureResponse(message, error), { status });
}

export function jsonValidation(zodError) {
  return NextResponse.json(validationFailureResponse(formatZodErrors(zodError)), {
    status: 400,
  });
}

export function jsonConflict() {
  return NextResponse.json(conflictResponse(), { status: 409 });
}

export async function parseJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function handleServiceError(err) {
  if (
    err.code === 'DUPLICATE_USER' ||
    err.code === 'DUPLICATE_ROLE' ||
    err.code === 'DUPLICATE_STEP' ||
    err.code === 'DUPLICATE_SAP' ||
    err.code === 'DUPLICATE_PO' ||
    err.code === 'DUPLICATE_ITEM'
  ) {
    return jsonError(err.message, err.code, 409);
  }
  if (err.code === 'VERSION_CONFLICT') {
    return jsonConflict();
  }
  if (err.code === 'NOT_FOUND') {
    return jsonError(err.message, err.code, 404);
  }
  if (err.code === 'FORBIDDEN') {
    return jsonError(err.message, 'FORBIDDEN', 403);
  }
  if (
    err.code === 'INVALID_STATUS' ||
    err.code === 'NO_SAP_PR' ||
    err.code === 'VENDOR_REQUIRED' ||
    err.code === 'NO_LINES' ||
    err.code === 'ROLE_NOT_FOUND' ||
    err.code === 'INVALID_FILE_TYPE' ||
    err.code === 'FILE_TOO_LARGE' ||
    err.code === 'INVALID_ID'
  ) {
    return jsonError(err.message, err.code, 400);
  }
  if (err.code === 'SAP_ITEM_FAILED' || err.code === 'SAP_FAILED') {
    return jsonError('SAP operation failed', err.code, 502);
  }
  if (err.code === 'HANA_UNAVAILABLE') {
    return jsonError('Item search is temporarily unavailable', err.code, 503);
  }
  return jsonError('Operation failed', err.message || 'SERVER_ERROR', 500);
}
