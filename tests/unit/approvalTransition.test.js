import { describe, expect, it, vi } from 'vitest';
import {
  APPROVAL_STEP_ALREADY_COMPLETED,
  assertApprovalVersionMatches,
  atomicDocumentStepTransition,
  buildAtomicStepFilter,
  createApprovalStepConflictError,
  rejectedStatusForDocumentType,
} from '@/lib/approvalTransition.js';
import { PO_STATUS } from '@/lib/poStatus.js';

describe('approvalTransition', () => {
  it('buildAtomicStepFilter matches current step and version', () => {
    const doc = { _id: 'abc', status: 'pending_pm', currentApprovalStep: 1, __v: 4 };
    expect(buildAtomicStepFilter(doc, 4)).toEqual({
      _id: 'abc',
      status: 'pending_pm',
      currentApprovalStep: 1,
      __v: 4,
    });
  });

  it('requires document version', () => {
    expect(() => assertApprovalVersionMatches({ __v: 2 }, undefined)).toThrow(/version/i);
    expect(() => assertApprovalVersionMatches({ __v: 2 }, 1)).toThrow(/changed/i);
    expect(() => assertApprovalVersionMatches({ __v: 2 }, 2)).not.toThrow();
  });

  it('creates step-already-completed error', () => {
    const err = createApprovalStepConflictError();
    expect(err.code).toBe(APPROVAL_STEP_ALREADY_COMPLETED);
    expect(err.message).toMatch(/already been completed/i);
  });

  it('atomic transition increments version and applies set fields', async () => {
    const updated = { _id: 'po1', status: 'pending_om', __v: 2 };
    const findOneAndUpdate = vi.fn().mockResolvedValue(updated);
    const Model = { findOneAndUpdate };

    const result = await atomicDocumentStepTransition(
      Model,
      { _id: 'po1', status: 'pending_pm', currentApprovalStep: 1, __v: 1 },
      { status: 'pending_om', currentApprovalStep: 2 },
    );

    expect(result).toBe(updated);
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'po1', status: 'pending_pm', currentApprovalStep: 1, __v: 1 },
      {
        $set: { status: 'pending_om', currentApprovalStep: 2 },
        $inc: { __v: 1 },
      },
      { new: true },
    );
  });

  it('atomic transition fails when conditional update misses', async () => {
    const Model = { findOneAndUpdate: vi.fn().mockResolvedValue(null) };
    await expect(
      atomicDocumentStepTransition(Model, { _id: 'po1', __v: 1 }, { status: 'rejected' }),
    ).rejects.toMatchObject({ code: APPROVAL_STEP_ALREADY_COMPLETED });
  });

  it('maps rejected status by document type', () => {
    expect(rejectedStatusForDocumentType('PO')).toBe(PO_STATUS.REJECTED);
    expect(rejectedStatusForDocumentType('PR')).toBe('Rejected');
    expect(rejectedStatusForDocumentType('APRI')).toBe('warehouse_rejected');
  });
});

describe('approvalTransition concurrency simulation', () => {
  it('only one of two parallel transitions succeeds', async () => {
    let locked = false;
    const findOneAndUpdate = vi.fn().mockImplementation(async () => {
      if (locked) return null;
      locked = true;
      return { _id: 'po1', status: 'pending_om', __v: 2 };
    });
    const Model = { findOneAndUpdate };
    const filter = { _id: 'po1', status: 'pending_pm', currentApprovalStep: 1, __v: 1 };
    const set = { status: 'pending_om', currentApprovalStep: 2 };

    const results = await Promise.allSettled([
      atomicDocumentStepTransition(Model, filter, set),
      atomicDocumentStepTransition(Model, filter, set),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason.code).toBe(APPROVAL_STEP_ALREADY_COMPLETED);
    expect(findOneAndUpdate).toHaveBeenCalledTimes(2);
  });
});
