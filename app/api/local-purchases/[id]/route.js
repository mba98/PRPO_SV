import { withAuth } from '@/lib/auth';
import {
  getLocalPurchaseById,
  updateLocalPurchase,
  deleteLocalPurchase,
} from '@/lib/localPurchasesService';
import { updateLocalPurchaseSchema } from '@/lib/validators/localPurchase';
import {
  jsonSuccess,
  jsonSuccessNoStore,
  jsonError,
  jsonValidation,
  parseJsonBody,
  handleServiceError,
} from '@/lib/apiHelpers';
import { wrapLocalPurchaseResponse } from '@/lib/localPurchaseDocument.js';
import { LP_LIST_PERMISSIONS } from '@/lib/permissions.js';

async function getHandler(_request, { params }, user) {
  try {
    const doc = await getLocalPurchaseById(params.id, user);
    if (!doc) return jsonError('Local Purchase not found', 'NOT_FOUND', 404);
    return jsonSuccessNoStore(doc);
  } catch (err) {
    return handleServiceError(err);
  }
}

async function patchHandler(request, { params }, user) {
  try {
    const body = await parseJsonBody(request);
    const parsed = updateLocalPurchaseSchema.safeParse(body);
    if (!parsed.success) return jsonValidation(parsed.error);
    const doc = await updateLocalPurchase(params.id, parsed.data, user);
    return jsonSuccess(wrapLocalPurchaseResponse(doc));
  } catch (err) {
    return handleServiceError(err);
  }
}

async function deleteHandler(_request, { params }, user) {
  try {
    const result = await deleteLocalPurchase(params.id, user);
    return jsonSuccess(result);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const GET = withAuth(getHandler, LP_LIST_PERMISSIONS);
export const PATCH = withAuth(patchHandler, ['lp.create']);
export const DELETE = withAuth(deleteHandler, ['lp.create']);
