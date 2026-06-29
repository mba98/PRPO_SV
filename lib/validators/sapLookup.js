import { z } from 'zod';

export const sapLookupQuerySchema = z.object({
  query: z.string().max(200).optional().default(''),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  page: z.coerce.number().int().min(1).optional().default(1),
});

export function parseSapLookupQuery(searchParams) {
  return sapLookupQuerySchema.parse({
    query: searchParams.get('query') ?? '',
    limit: searchParams.get('limit') ?? undefined,
    page: searchParams.get('page') ?? undefined,
  });
}
