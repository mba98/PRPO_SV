import { z } from 'zod';

export const createPoFromPrSchema = z.object({
  vendor: z.string().min(1, 'Vendor (CardCode) is required'),
});
