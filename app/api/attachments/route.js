import { z } from 'zod';
import { withAuth } from '@/lib/auth';
import { saveAttachmentMetadata } from '@/lib/attachmentsService.js';
import {
  jsonSuccess,
  jsonValidation,
  parseJsonBody,
  handleServiceError,
} from '@/lib/apiHelpers';

const metaSchema = z.object({
  documentType: z.enum(['PR', 'PO', 'APRI']),
  documentId: z.string().min(1),
  s3Key: z.string().min(1),
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  fileSize: z.coerce.number().positive(),
  approvalStep: z.string().optional(),
});

async function postHandler(request, _ctx, user) {
  try {
    const body = await parseJsonBody(request);
    const parsed = metaSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidation(parsed.error);
    }
    const row = await saveAttachmentMetadata({ ...parsed.data, uploadedBy: user });
    return jsonSuccess(row, undefined, 201);
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
