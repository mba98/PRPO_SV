import { describe, expect, it } from 'vitest';
import {
  COMPLETION_POLICY,
  completionPolicyLabel,
  getCompletionPolicyDescription,
  isImplementedCompletionPolicy,
  normalizeCompletionPolicy,
} from '@/lib/approvalPolicies.js';

describe('approvalPolicies', () => {
  it('defaults missing policy to ANY_ONE', () => {
    expect(normalizeCompletionPolicy(undefined)).toBe(COMPLETION_POLICY.ANY_ONE);
    expect(normalizeCompletionPolicy(null)).toBe(COMPLETION_POLICY.ANY_ONE);
    expect(completionPolicyLabel(undefined)).toBe('Any one approver');
  });

  it('implements ANY_ONE only at runtime', () => {
    expect(isImplementedCompletionPolicy('ANY_ONE')).toBe(true);
    expect(isImplementedCompletionPolicy(undefined)).toBe(true);
    expect(isImplementedCompletionPolicy('ALL')).toBe(false);
    expect(isImplementedCompletionPolicy('MINIMUM_COUNT')).toBe(false);
  });

  it('exposes UI description for ANY_ONE', () => {
    expect(getCompletionPolicyDescription('ANY_ONE')).toMatch(/any one authorized user/i);
  });
});
