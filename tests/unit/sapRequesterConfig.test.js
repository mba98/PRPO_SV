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

  it('exports dev default code 12', () => {
    expect(DEV_DEFAULT_SAP_REQUESTER_CODE).toBe('12');
  });

  it('prefers SAP_REQUESTER_CODE_REQUESTER', () => {
    process.env.SAP_REQUESTER_CODE_REQUESTER = '99';
    process.env.DEFAULT_SAP_REQUESTER_CODE = '88';
    process.env.NODE_ENV = 'development';
    expect(resolveDefaultSapRequesterCode()).toBe('99');
  });

  it('falls back to DEFAULT_SAP_REQUESTER_CODE', () => {
    delete process.env.SAP_REQUESTER_CODE_REQUESTER;
    process.env.DEFAULT_SAP_REQUESTER_CODE = '77';
    process.env.NODE_ENV = 'development';
    expect(resolveDefaultSapRequesterCode()).toBe('77');
  });

  it('uses dev default 12 when unset outside production', () => {
    delete process.env.SAP_REQUESTER_CODE_REQUESTER;
    delete process.env.DEFAULT_SAP_REQUESTER_CODE;
    process.env.NODE_ENV = 'development';
    expect(resolveDefaultSapRequesterCode()).toBe('12');
  });

  it('returns null in production without env', () => {
    delete process.env.SAP_REQUESTER_CODE_REQUESTER;
    delete process.env.DEFAULT_SAP_REQUESTER_CODE;
    process.env.NODE_ENV = 'production';
    expect(resolveDefaultSapRequesterCode()).toBeNull();
  });
});
