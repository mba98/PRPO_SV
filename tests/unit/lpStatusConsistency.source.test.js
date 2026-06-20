import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Local Purchase detail cache source', () => {
  const cacheSource = fs.readFileSync(
    path.resolve(process.cwd(), 'lib/documentClientCache.js'),
    'utf8',
  );
  const hookSource = fs.readFileSync(
    path.resolve(process.cwd(), 'lib/hooks/usePortalDocument.js'),
    'utf8',
  );
  const apiSource = fs.readFileSync(
    path.resolve(process.cwd(), 'app/api/local-purchases/[id]/route.js'),
    'utf8',
  );

  it('defines LP detail cache flags and version resolution', () => {
    expect(cacheSource).toContain('lpDocumentHasDetailFlags');
    expect(cacheSource).toContain('pickNewerPortalDocument');
    expect(cacheSource).toContain("kind === 'LOCAL_PURCHASE'");
  });

  it('always refreshes LOCAL_PURCHASE detail from the API', () => {
    expect(hookSource).toContain('shouldBypassPortalDocumentCache');
    expect(hookSource).toContain('resolvePortalDocument');
    expect(hookSource).toContain('Local Purchase detail state');
  });

  it('returns detail GET responses with no-store cache control', () => {
    expect(apiSource).toContain('jsonSuccessNoStore');
  });
});
