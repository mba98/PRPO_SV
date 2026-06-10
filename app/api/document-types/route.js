import { withAuth } from '@/lib/auth';
import { createDocumentTypeSchema } from '@/lib/validators/permission';
import { listDocumentTypes, createDocumentType } from '@/lib/documentTypesService';
import {
  jsonSuccess,
  jsonValidation,
  parseJsonBody,
  handleServiceError,
} from '@/lib/apiHelpers';

async function getHandler() {
  try {
    return jsonSuccess(await listDocumentTypes());
  } catch (err) {
    return handleServiceError(err);
  }
}

async function postHandler(request) {
  try {
    const body = await parseJsonBody(request);
    const parsed = createDocumentTypeSchema.safeParse(body);
    if (!parsed.success) return jsonValidation(parsed.error);
    const docType = await createDocumentType(parsed.data);
    return jsonSuccess(docType, undefined, 201);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const GET = withAuth(getHandler, ['admin.approval_matrix', 'admin.roles']);
export const POST = withAuth(postHandler, ['admin.approval_matrix']);
