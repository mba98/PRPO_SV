import { withAuth } from '@/lib/auth';
import { listComments } from '@/lib/commentsService';
import { documentScopeSchema } from '@/lib/validators/comment';
import {
  jsonSuccess,
  jsonValidation,
  handleServiceError,
} from '@/lib/apiHelpers';

const REQUIRED_PERMS = [
  'pr.create',
  'pr.approve.whs',
  'pr.approve.pm',
  'po.create',
  'po.approve.pm',
  'po.approve.finance',
  'apinvoice.create',
  'view.all',
];

async function getHandler(_request, { params }, user) {
  try {
    const parsed = documentScopeSchema.safeParse(params);
    if (!parsed.success) {
      return jsonValidation(parsed.error);
    }
    const items = await listComments(
      user,
      parsed.data.documentType,
      parsed.data.documentId,
    );
    return jsonSuccess(items);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const GET = withAuth(getHandler, REQUIRED_PERMS);
