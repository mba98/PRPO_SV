import { z } from 'zod';
import { withAuth } from '@/lib/auth';
import { listComments, addComment } from '@/lib/commentsService';
import {
  jsonSuccess,
  jsonValidation,
  parseJsonBody,
  handleServiceError,
} from '@/lib/apiHelpers';

const commentSchema = z.object({
  comment: z.string().min(1, 'Comment is required'),
});

const VIEW_PERMS = ['pr.create', 'pr.approve.whs', 'pr.approve.pm', 'view.all'];

async function getHandler(_request, { params }) {
  try {
    const comments = await listComments('PR', params.id);
    return jsonSuccess(comments);
  } catch (err) {
    return handleServiceError(err);
  }
}

async function postHandler(request, { params }, user) {
  try {
    const body = await parseJsonBody(request);
    const parsed = commentSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidation(parsed.error);
    }
    const row = await addComment('PR', params.id, parsed.data.comment, user);
    return jsonSuccess(row, undefined, 201);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const GET = withAuth(getHandler, VIEW_PERMS);
export const POST = withAuth(postHandler, VIEW_PERMS);
