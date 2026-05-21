import { describe, expect, it } from 'vitest';
import mongoose from 'mongoose';

describe('mongoose model registration', () => {
  it('registers models required for populate refs', async () => {
    await import('@/models/index.js');
    expect(mongoose.models.Role).toBeDefined();
    expect(mongoose.models.User).toBeDefined();
    expect(mongoose.models.ApprovalMatrix).toBeDefined();
    expect(mongoose.models.EmailGroup).toBeDefined();
  });
});
