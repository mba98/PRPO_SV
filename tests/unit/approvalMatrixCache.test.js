import { describe, expect, it, beforeEach } from 'vitest';
import { cacheClear, cacheGet, cacheSet } from '@/lib/memoryCache.js';
import { invalidateApprovalStepsCache } from '@/lib/approvalEngine.js';

const APPROVAL_STEPS_CACHE_PREFIX = 'approval-steps:';

describe('approval matrix cache invalidation', () => {
  beforeEach(() => {
    cacheClear();
  });

  it('invalidates cached steps for a document type', () => {
    const key = `${APPROVAL_STEPS_CACHE_PREFIX}PO`;
    cacheSet(key, [{ stepOrder: 1, completionPolicy: 'ANY_ONE' }], 60_000);
    expect(cacheGet(key)).toHaveLength(1);

    invalidateApprovalStepsCache('PO');
    expect(cacheGet(key)).toBeUndefined();
  });

  it('invalidates all approval step caches when document type omitted', () => {
    cacheSet(`${APPROVAL_STEPS_CACHE_PREFIX}PR`, [{ stepOrder: 1 }], 60_000);
    cacheSet(`${APPROVAL_STEPS_CACHE_PREFIX}PO`, [{ stepOrder: 1 }], 60_000);

    invalidateApprovalStepsCache();

    expect(cacheGet(`${APPROVAL_STEPS_CACHE_PREFIX}PR`)).toBeUndefined();
    expect(cacheGet(`${APPROVAL_STEPS_CACHE_PREFIX}PO`)).toBeUndefined();
  });

  it('requires reload after completion policy change (cache miss)', () => {
    const key = `${APPROVAL_STEPS_CACHE_PREFIX}PO`;
    cacheSet(key, [{ stepOrder: 1, completionPolicy: 'ANY_ONE' }], 60_000);

    invalidateApprovalStepsCache('PO');

    const freshSteps = [{ stepOrder: 1, completionPolicy: 'ANY_ONE', stepName: 'PM' }];
    cacheSet(key, freshSteps, 60_000);
    expect(cacheGet(key)[0].stepName).toBe('PM');
  });
});
