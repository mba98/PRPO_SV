'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/stores/authStore';
import { useMotionSafe } from '@/components/ui/useMotionSafe';
import { login as loginAr, common } from '@/lib/i18n';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setUser = useAuthStore((s) => s.setUser);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const cardProps = useMotionSafe({
    initial: { opacity: 0, y: 16, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { duration: 0.3 },
  });

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
        setError(json.message || loginAr.loginFailed);
        return;
      }

      setUser(json.data.user);
      const from = searchParams.get('from') || '/dashboard';
      router.push(from.startsWith('/') ? from : '/dashboard');
      router.refresh();
    } catch (err) {
      setError(err.message || loginAr.loginFailed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-100 to-slate-50 px-4 py-12">
      <motion.div className="w-full max-w-md" {...cardProps}>
        <div className="card-elevated">
          <header className="mb-8 border-b border-slate-100 pb-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
              {loginAr.title}
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">{common.appName}</h1>
            <p className="mt-2 text-sm text-slate-600">{loginAr.subtitle}</p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate={false}>
            <div>
              <label htmlFor="username" className="mb-2 block text-sm font-medium text-slate-700">
                {loginAr.username}
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
                {loginAr.password}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
              />
            </div>

            <div className="min-h-[2.5rem] text-sm" role="alert" aria-live="polite">
              {error ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">
                  {error}
                </p>
              ) : null}
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? loginAr.signingIn : loginAr.signIn}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
