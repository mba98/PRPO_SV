import { z } from 'zod';
import { withAuth } from '@/lib/auth';
import { signUpload } from '@/lib/attachmentsService.js';
import {
  jsonSuccess,
  jsonValidation,
  parseJsonBody,
  handleServiceError,
} from '@/lib/apiHelpers';

const signSchema = z.object({
  documentType: z.enum(['PR', 'PO', 'APRI']),
  documentId: z.string().min(1),
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  fileSize: z.coerce.number().positive(),
});

async function postHandler(request, _ctx, _user) {
  try {
    const body = await parseJsonBody(request);
    const parsed = signSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidation(parsed.error);
    }
    const data = await signUpload(parsed.data);
    return jsonSuccess(data);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const POST = withAuth(postHandler, [
  'pr.create',
  'pr.approve.whs',
  'pr.approve.pm',
  'po.create',
  'apinvoice.create',
  'view.all',
]);
