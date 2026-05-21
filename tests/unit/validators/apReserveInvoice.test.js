import { describe, expect, it } from 'vitest';
import { createApriFromPoSchema, retryApriSapSchema } from '@/lib/validators/apReserveInvoice';

describe('apReserveInvoice validators', () => {
  it('accepts empty body for create from PO', () => {
    expect(createApriFromPoSchema.safeParse({}).success).toBe(true);
    expect(createApriFromPoSchema.safeParse(undefined).success).toBe(true);
  });

  it('rejects unknown fields on create', () => {
    expect(createApriFromPoSchema.safeParse({ extra: true }).success).toBe(false);
  });

  it('accepts empty body for retry SAP', () => {
    expect(retryApriSapSchema.safeParse({}).success).toBe(true);
  });
});
