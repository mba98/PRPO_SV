import { Suspense } from 'react';
import LoginForm from './LoginForm';

function LoginFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-md">
        <div className="animate-pulse space-y-4">
          <div className="mx-auto h-6 w-48 rounded bg-slate-200" />
          <div className="h-10 rounded bg-slate-100" />
          <div className="h-10 rounded bg-slate-100" />
          <div className="h-10 rounded bg-indigo-200" />
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
