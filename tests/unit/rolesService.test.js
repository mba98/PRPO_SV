import { describe, expect, it, vi, beforeEach } from 'vitest';
import { sanitizeRole } from '@/lib/rolesService';

vi.mock('@/models/User', () => ({
  default: {
    countDocuments: vi.fn(),
  },
}));

vi.mock('@/models/Role', () => ({
  default: {
    findById: vi.fn(),
    findByIdAndDelete: vi.fn(),
  },
}));

vi.mock('@/lib/mongodb', () => ({
  connectDB: vi.fn().mockResolvedValue(true),
}));

describe('sanitizeRole', () => {
  it('maps role document to API shape', () => {
    const role = {
      _id: '507f1f77bcf86cd799439011',
      name: 'Admin',
      permissions: ['view.all'],
      __v: 2,
    };
    expect(sanitizeRole(role)).toEqual({
      id: '507f1f77bcf86cd799439011',
      name: 'Admin',
      permissions: ['view.all'],
      createdAt: undefined,
      updatedAt: undefined,
      __v: 2,
    });
  });
});

describe('deleteRole assignment guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ROLE_IN_USE when users are assigned', async () => {
    const User = (await import('@/models/User')).default;
    const Role = (await import('@/models/Role')).default;

    Role.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        name: 'Requester',
      }),
    });
    User.countDocuments.mockResolvedValue(3);

    const { deleteRole } = await import('@/lib/rolesService');
    const result = await deleteRole('507f1f77bcf86cd799439011');

    expect(result.error).toBe('ROLE_IN_USE');
    expect(result.message).toContain('3');
  });
});
