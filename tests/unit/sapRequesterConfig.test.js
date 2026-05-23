import { afterEach, describe, expect, it } from 'vitest';
import {
  DEV_DEFAULT_SAP_REQUESTER_CODE,
  resolveDefaultSapRequesterCode,
} from '@/lib/sap/sapRequesterConfig.js';

describe('resolveDefaultSapRequesterCode', () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
  });

  it('exports dev default code manager', () => {
    expect(DEV_DEFAULT_SAP_REQUESTER_CODE).toBe('manager');
  });

  it('prefers SAP_REQUESTER_CODE_REQUESTER', () => {
    process.env.SAP_REQUESTER_CODE_REQUESTER = 'other';
    process.env.DEFAULT_SAP_REQUESTER_CODE = '88';
    process.env.NODE_ENV = 'development';
    expect(resolveDefaultSapRequesterCode()).toBe('other');
  });

  it('falls back to DEFAULT_SAP_REQUESTER_CODE', () => {
    delete process.env.SAP_REQUESTER_CODE_REQUESTER;
    process.env.DEFAULT_SAP_REQUESTER_CODE = 'manager';
    process.env.NODE_ENV = 'development';
    expect(resolveDefaultSapRequesterCode()).toBe('manager');
  });

  it('uses dev default manager when unset outside production', () => {
    delete process.env.SAP_REQUESTER_CODE_REQUESTER;
    delete process.env.DEFAULT_SAP_REQUESTER_CODE;
    process.env.NODE_ENV = 'development';
    expect(resolveDefaultSapRequesterCode()).toBe('manager');
  });

  it('returns null in production without env', () => {
    delete process.env.SAP_REQUESTER_CODE_REQUESTER;
    delete process.env.DEFAULT_SAP_REQUESTER_CODE;
    process.env.NODE_ENV = 'production';
    expect(resolveDefaultSapRequesterCode()).toBeNull();
  });
});
