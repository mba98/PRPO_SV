export const COMPLETION_POLICY = Object.freeze({
  ANY_ONE: 'ANY_ONE',
  ALL: 'ALL',
  MINIMUM_COUNT: 'MINIMUM_COUNT',
});

/** Policies with runtime engine support. */
export const IMPLEMENTED_COMPLETION_POLICIES = Object.freeze(['ANY_ONE']);

export const COMPLETION_POLICY_LABELS = Object.freeze({
  [COMPLETION_POLICY.ANY_ONE]: 'Any one approver',
  [COMPLETION_POLICY.ALL]: 'All approvers',
  [COMPLETION_POLICY.MINIMUM_COUNT]: 'Minimum count',
});

export const COMPLETION_POLICY_UI_DESCRIPTION = Object.freeze({
  [COMPLETION_POLICY.ANY_ONE]: 'Approval by any one authorized user completes this step.',
});

export function normalizeCompletionPolicy(policy) {
  return policy || COMPLETION_POLICY.ANY_ONE;
}

export function completionPolicyLabel(policy) {
  return COMPLETION_POLICY_LABELS[normalizeCompletionPolicy(policy)] || 'Any one approver';
}

export function getCompletionPolicyDescription(policy) {
  return COMPLETION_POLICY_UI_DESCRIPTION[normalizeCompletionPolicy(policy)] || '';
}

export function isImplementedCompletionPolicy(policy) {
  return IMPLEMENTED_COMPLETION_POLICIES.includes(normalizeCompletionPolicy(policy));
}

export function assertImplementedCompletionPolicy(step) {
  if (!step) return;
  if (!isImplementedCompletionPolicy(step.completionPolicy)) {
    const err = new Error('This approval step uses an unsupported completion policy.');
    err.code = 'INVALID_STATUS';
    throw err;
  }
}
