import { Suspense } from 'react';
import { cookies } from 'next/headers';
import {
  verifyToken,
  getCurrentUser,
  sanitizeUser,
  getSessionCookieName,
} from '@/lib/auth';
import LoginForm from './LoginForm';

function LoginFallback() {
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="animate-pulse space-y-4">
          <div className="mx-auto h-6 w-48 rounded bg-muted" />
          <div className="h-10 rounded bg-muted" />
          <div className="h-10 rounded bg-muted" />
          <div className="h-10 rounded bg-primary/30" />
        </div>
      </div>
    </div>
  );
}

async function loadSessionUser() {
  const token = cookies().get(getSessionCookieName())?.value;
  if (!token) {
    return null;
  }
  try {
    const session = await verifyToken(token);
    const user = await getCurrentUser(session);
    if (!user) {
      return null;
    }
    const safe = sanitizeUser(user);
    return {
      id: safe.id,
      name: safe.name,
      username: safe.username,
    };
  } catch {
    return null;
  }
}

export default async function LoginPage() {
  const sessionUser = await loadSessionUser();
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm sessionUser={sessionUser} />
    </Suspense>
  );
}
