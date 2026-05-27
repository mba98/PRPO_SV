import { withAuth } from '@/lib/auth';
import { updateEmailGroupSchema } from '@/lib/validators/emailGroup';
import { updateEmailGroup } from '@/lib/emailGroupsService';
import {
  jsonSuccess,
  jsonValidation,
  parseJsonBody,
  handleServiceError,
} from '@/lib/apiHelpers';

async function putHandler(request, context) {
  try {
    const { id } = await context.params;
    const body = await parseJsonBody(request);
    const parsed = updateEmailGroupSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidation(parsed.error);
    }
    const group = await updateEmailGroup(id, parsed.data);
    return jsonSuccess(group);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const PUT = withAuth(putHandler, ['admin.settings']);
