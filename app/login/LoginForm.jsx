'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setUser = useAuthStore((s) => s.setUser);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      const json = await res.json();

      if (!json.success) {
        setError(json.message || 'Login failed');
        return;
      }

      setUser(json.data.user);
      const from = searchParams.get('from') || '/dashboard';
      router.push(from.startsWith('/') ? from : '/dashboard');
      router.refresh();
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-md">
          <header className="mb-8 border-b border-slate-100 pb-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
              Procurement Workflow
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Procurement Portal</h1>
            <p className="mt-2 text-sm text-slate-600">Sign in with your portal account</p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate={false}>
            <div>
              <label
                htmlFor="username"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="block h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div
              className="min-h-[2.5rem] rounded-md text-sm"
              role="alert"
              aria-live="polite"
            >
              {error ? (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">
                  {error}
                </p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="h-10 w-full rounded-md bg-indigo-600 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
