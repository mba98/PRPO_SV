import { z } from 'zod';

export function formatZodErrors(error) {
  return error.errors.map((e) => ({
    path: e.path.join('.') || 'body',
    message: e.message,
  }));
}

export const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Must be a valid ObjectId');
