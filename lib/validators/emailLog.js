import { z } from 'zod';

export const listEmailLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  eventKey: z.string().trim().optional(),
  relatedDocumentType: z.enum(['PR', 'PO', 'APRI']).optional(),
  relatedDocumentId: z
    .string()
    .regex(/^[a-fA-F0-9]{24}$/)
    .optional(),
  emailStatus: z.enum(['Sent', 'Failed']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  q: z.string().trim().optional(),
});
