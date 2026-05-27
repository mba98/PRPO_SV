import { describe, expect, it } from 'vitest';
import {
  createEmailGroupSchema,
  updateEmailGroupSchema,
} from '@/lib/validators/emailGroup';

describe('emailGroup validators', () => {
  it('accepts valid email group config', () => {
    const parsed = createEmailGroupSchema.safeParse({
      eventKey: 'pr.created',
      recipients: [{ email: 'whs@example.com' }, { role: '507f1f77bcf86cd799439011' }],
      ccRoles: ['507f1f77bcf86cd799439012'],
      isActive: true,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid email address', () => {
    const parsed = createEmailGroupSchema.safeParse({
      eventKey: 'pr.created',
      recipients: [{ email: 'not-an-email' }],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects unknown event key', () => {
    const parsed = createEmailGroupSchema.safeParse({
      eventKey: 'invalid.event',
      recipients: [{ email: 'a@b.com' }],
    });
    expect(parsed.success).toBe(false);
  });

  it('update schema allows partial fields', () => {
    const parsed = updateEmailGroupSchema.safeParse({ isActive: false });
    expect(parsed.success).toBe(true);
  });
});
