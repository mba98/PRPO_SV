import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth';
import { successResponse } from '@/lib/errors';

export async function POST() {
  const response = NextResponse.json(successResponse({ loggedOut: true }));
  return clearSessionCookie(response);
}
