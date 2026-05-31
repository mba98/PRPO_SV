'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useI18n } from '@/lib/hooks/useI18n';
import { Button, FormField, Input, LanguageSelector, SunMoonToggle } from '@/components/ui';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setUser = useAuthStore((s) => s.setUser);
  const { login, common } = useI18n();

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
        setError(json.message || login.loginFailed);
        return;
      }

      setUser(json.data.user);
      const from = searchParams.get('from') || '/dashboard';
      router.push(from.startsWith('/') ? from : '/dashboard');
      router.refresh();
    } catch (err) {
      setError(err.message || login.loginFailed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="absolute end-4 top-4 flex items-center gap-2 sm:end-6 sm:top-6">
        <SunMoonToggle />
        <LanguageSelector compact />
      </div>
      <div className="login-card">
        <header className="login-card-header">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
            {login.title}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-foreground">{common.appName}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{login.subtitle}</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate={false}>
          <FormField label={login.username} htmlFor="username" required>
            <Input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </FormField>

          <FormField label={login.password} htmlFor="password" required>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>

          <div className="min-h-[2.5rem] text-sm" role="alert" aria-live="polite">
            {error ? (
              <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
                {error}
              </p>
            ) : null}
          </div>

          <Button type="submit" loading={loading} className="w-full">
            {loading ? login.signingIn : login.signIn}
          </Button>
        </form>
      </div>
    </div>
  );
}
