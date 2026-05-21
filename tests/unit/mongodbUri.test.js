import { describe, expect, it } from 'vitest';
import {
  formatMongoConnectionError,
  getMongoConnectionHint,
  normalizeMongoUri,
  summarizeMongoUri,
  validateMongoUri,
} from '@/lib/mongodbUri';

describe('normalizeMongoUri', () => {
  it('fixes mmongodb+srv typo', () => {
    expect(normalizeMongoUri('mmongodb+srv://cluster.example.net/db')).toBe(
      'mongodb+srv://cluster.example.net/db',
    );
  });
});

describe('summarizeMongoUri', () => {
  it('summarizes SRV URI without credentials', () => {
    const s = summarizeMongoUri(
      'mongodb+srv://user:secret@cluster0.abc.mongodb.net/procurement_portal?retryWrites=true',
    );
    expect(s.ok).toBe(true);
    expect(s.scheme).toBe('mongodb+srv');
    expect(s.hosts).toBe('cluster0.abc.mongodb.net');
    expect(s.isSrv).toBe(true);
  });

  it('rejects invalid scheme', () => {
    const s = summarizeMongoUri('postgres://localhost/db');
    expect(s.ok).toBe(false);
    expect(s.issue).toBe('invalid_scheme');
  });

  it('rejects mmongodb typo', () => {
    const s = summarizeMongoUri('mmongodb+srv://cluster.net/db');
    expect(s.ok).toBe(false);
  });
});

describe('validateMongoUri', () => {
  it('throws on invalid URI', () => {
    expect(() => validateMongoUri('bad-scheme://x')).toThrow();
  });
});

describe('getMongoConnectionHint', () => {
  it('hints for SRV failure', () => {
    const hint = getMongoConnectionHint(
      new Error('querySrv ECONNREFUSED _mongodb._tcp.cluster.mongodb.net'),
    );
    expect(hint).toContain('SRV');
    expect(hint).toContain('non-SRV');
  });

  it('hints for server selection timeout', () => {
    const hint = getMongoConnectionHint(new Error('Server selection timed out after 30000 ms'));
    expect(hint).toContain('Network Access');
  });

  it('hints for auth failure', () => {
    const hint = getMongoConnectionHint(new Error('bad auth Authentication failed'));
    expect(hint).toContain('Authentication');
  });
});

describe('formatMongoConnectionError', () => {
  it('includes hint in formatted output', () => {
    const text = formatMongoConnectionError(new Error('Server selection timed out after 30000 ms'));
    expect(text).toContain('MongoDB connection failed');
    expect(text).toContain('Hint:');
  });
});
