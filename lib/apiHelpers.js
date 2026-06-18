import { NextResponse } from 'next/server';
import {
  conflictResponse,
  failureResponse,
  sapFailureResponse,
  successResponse,
  validationFailureResponse,
} from '@/lib/errors';
import { formatZodErrors } from '@/lib/validators/common';

export function jsonSuccess(data, pagination, status = 200) {
  return NextResponse.json(successResponse(data, pagination), { status });
}

export function jsonSuccessCached(data, status = 200) {
  return NextResponse.json(successResponse(data), {
    status,
    headers: { 'Cache-Control': 'private, max-age=300' },
  });
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
    err.code === 'DUPLICATE_ITEM' ||
    err.code === 'DUPLICATE_EMAIL_GROUP' ||
    err.code === 'DUPLICATE_PERMISSION' ||
    err.code === 'DUPLICATE_DOCUMENT_TYPE' ||
    err.code === 'PERMISSION_IN_USE'
  ) {
    return jsonError(err.message, err.code, 409);
  }
  if (err.code === 'VERSION_CONFLICT') {
    return jsonConflict();
  }
  if (err.code === 'APPROVAL_STEP_ALREADY_COMPLETED') {
    return NextResponse.json(
      failureResponse(err.message, 'APPROVAL_STEP_ALREADY_COMPLETED'),
      { status: 409 },
    );
  }
  if (err.code === 'APRI_ALREADY_CREATING_OR_CREATED') {
    return NextResponse.json(
      failureResponse(err.message, 'APRI_ALREADY_CREATING_OR_CREATED'),
      { status: 409 },
    );
  }
  if (err.code === 'APRI_QUANTITY_EXCEEDS_PO') {
    return NextResponse.json(
      {
        success: false,
        error: err.code,
        message: err.message,
        errors: err.errors || [],
      },
      { status: 400 },
    );
  }
  if (err.code === 'VALIDATION') {
    return jsonError(err.message, err.code, 400);
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
    err.code === 'INVALID_FILE_SIZE' ||
    err.code === 'INVALID_ID' ||
    err.code === 'INVALID_TYPE' ||
    err.code === 'INVALID_S3_KEY' ||
    err.code === 'INVALID_ATTACHMENT_SCOPE' ||
    err.code === 'SAP_VALIDATION'
  ) {
    return jsonError(err.message, err.code, 400);
  }
  if (err.code === 'SAP_ITEM_FAILED' || err.code === 'SAP_FAILED') {
    const sapError = err.sapError || {
      code: err.code,
      message: err.message || 'SAP operation failed',
    };
    return NextResponse.json(
      sapFailureResponse(sapError.message || 'SAP operation failed', err.code, sapError),
      { status: err.status || 502 },
    );
  }
  if (err.code === 'HANA_UNAVAILABLE' || err.code === 'SAP_LOOKUP_FAILED' || err.code === 'SAP_SL_UNAVAILABLE') {
    return jsonError(err.message || 'Lookup is temporarily unavailable', err.code, 503);
  }
  return jsonError('Operation failed', err.message || 'SERVER_ERROR', 500);
}
