import { describe, expect, it } from 'vitest';
import { handleServiceError } from '@/lib/apiHelpers.js';
import { createApprovalStepConflictError } from '@/lib/approvalTransition.js';

describe('handleServiceError approval conflicts', () => {
  it('returns 409 with APPROVAL_STEP_ALREADY_COMPLETED', async () => {
    const response = handleServiceError(createApprovalStepConflictError());
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('APPROVAL_STEP_ALREADY_COMPLETED');
    expect(body.message).toMatch(/already been completed/i);
  });
});
