import { describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';
import { getJwtSecretKey } from '@/lib/jwtConfig.js';
import { verifySessionToken } from '@/lib/sessionJwt.js';

describe('sessionJwt', () => {
  it('returns invalid for empty token', async () => {
    const result = await verifySessionToken('');
    expect(result.valid).toBe(false);
    expect(result.payload).toBeUndefined();
  });

  it('returns valid payload for signed token', async () => {
    const token = await new SignJWT({ userId: 'abc123' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(getJwtSecretKey());

    const result = await verifySessionToken(token);
    expect(result.valid).toBe(true);
    expect(result.payload.userId).toBe('abc123');
  });

  it('returns invalid for tampered token', async () => {
    const token = await new SignJWT({ userId: 'abc123' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(getJwtSecretKey());

    const result = await verifySessionToken(`${token}x`);
    expect(result.valid).toBe(false);
  });
});
