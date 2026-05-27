import { withAuth } from '@/lib/auth';
import {
  createEmailGroupSchema,
} from '@/lib/validators/emailGroup';
import { listEmailGroups, createEmailGroup } from '@/lib/emailGroupsService';
import {
  EVENT_LABELS,
  WORKFLOW_EMAIL_EVENT_KEYS,
} from '@/lib/emailRecipientConfig';
import {
  jsonSuccess,
  jsonValidation,
  parseJsonBody,
  handleServiceError,
} from '@/lib/apiHelpers';

async function getHandler() {
  try {
    const groups = await listEmailGroups();
    return jsonSuccess({
      groups,
      eventKeys: WORKFLOW_EMAIL_EVENT_KEYS,
      eventLabels: EVENT_LABELS,
    });
  } catch (err) {
    return handleServiceError(err);
  }
}

async function postHandler(request) {
  try {
    const body = await parseJsonBody(request);
    const parsed = createEmailGroupSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidation(parsed.error);
    }
    const group = await createEmailGroup(parsed.data);
    return jsonSuccess(group, undefined, 201);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const GET = withAuth(getHandler, ['admin.settings']);
export const POST = withAuth(postHandler, ['admin.settings']);
