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
  if (err.code === 'DUPLICATE_USER' || err.code === 'DUPLICATE_ROLE' || err.code === 'DUPLICATE_STEP') {
    return jsonError(err.message, err.code, 409);
  }
  if (err.code === 'ROLE_NOT_FOUND') {
    return jsonError(err.message, err.code, 400);
  }
  return jsonError('Operation failed', err.message || 'SERVER_ERROR', 500);
}
