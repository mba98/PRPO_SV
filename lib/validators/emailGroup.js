import { z } from 'zod';
import { WORKFLOW_EMAIL_EVENT_KEYS } from '@/lib/emailRecipientConfig.js';

const objectIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, 'Must be a valid ObjectId');

const emailSchema = z
  .string()
  .trim()
  .email('Invalid email address');

const recipientSchema = z
  .object({
    email: emailSchema.optional(),
    userId: objectIdSchema.optional(),
    role: objectIdSchema.optional(),
  })
  .refine((r) => r.email || r.userId || r.role, {
    message: 'Recipient must include email, userId, or role',
  });

export const createEmailGroupSchema = z.object({
  eventKey: z.enum(WORKFLOW_EMAIL_EVENT_KEYS),
  recipients: z.array(recipientSchema).default([]),
  ccRoles: z.array(objectIdSchema).default([]),
  isActive: z.boolean().default(true),
});

export const updateEmailGroupSchema = z.object({
  recipients: z.array(recipientSchema).optional(),
  ccRoles: z.array(objectIdSchema).optional(),
  isActive: z.boolean().optional(),
});

export const sendTestEmailSchema = z.object({
  to: emailSchema.optional(),
  eventKey: z.enum(WORKFLOW_EMAIL_EVENT_KEYS).optional(),
});
