'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useI18n } from '@/lib/hooks/useI18n';
import {
  Button,
  FormField,
  Input,
  LanguageSelector,
  PasswordInput,
  SunMoonToggle,
} from '@/components/ui';

const LOGIN_LOGO_LIGHT = '/svnewlogo-light1.png';
const LOGIN_LOGO_DARK = '/svnewlogo-dark1.png';
const SPC_WEBSITE_URL = 'https://www.spc-it.com.iq/';

export default function LoginForm({ sessionUser: initialSessionUser = null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setUser = useAuthStore((s) => s.setUser);
  const { login, common, isRtl } = useI18n();

  const [showCredentialForm, setShowCredentialForm] = useState(!initialSessionUser);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const from = searchParams.get('from') || '/dashboard';
  const redirectTo = from.startsWith('/') ? from : '/dashboard';

  async function handleContinue() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const json = await res.json();
      if (!json.success) {
        setShowCredentialForm(true);
        setError(json.message || login.loginFailed);
        return;
      }
      setUser(json.data.user);
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setShowCredentialForm(true);
      setError(err.message || login.loginFailed);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOutAndSwitch() {
    setSigningOut(true);
    setError('');
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      useAuthStore.getState().setUser(null);
      setShowCredentialForm(true);
      setUsername('');
      setPassword('');
    } catch (err) {
      setError(err.message || login.loginFailed);
    } finally {
      setSigningOut(false);
    }
  }

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
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(err.message || login.loginFailed);
    } finally {
      setLoading(false);
    }
  }

  const submitLabel = loading ? login.signingIn : login.signIn;
  const displayName =
    initialSessionUser?.name || initialSessionUser?.username || login.currentUser;

  const showSessionCard = initialSessionUser && !showCredentialForm;

  return (
    <div className="login-page">
      <div className="absolute end-4 top-4 z-10 flex items-center gap-2 sm:end-6 sm:top-6">
        <SunMoonToggle />
        <LanguageSelector />
      </div>

      <div className="login-page-stack">
        <div className="login-card">
          <header className="login-card-header">
            <p className="login-card-eyebrow">{common.appName}</p>
            <div className="login-card-logo-wrap">
              <Image
                src={LOGIN_LOGO_LIGHT}
                alt={common.appName}
                width={360}
                height={120}
                priority
                className="login-card-logo login-card-logo--light"
              />
              <Image
                src={LOGIN_LOGO_DARK}
                alt={common.appName}
                width={360}
                height={120}
                priority
                className="login-card-logo login-card-logo--dark"
              />
            </div>
            <p className="login-card-subtitle">
              {showSessionCard ? login.sessionActive : login.subtitle}
            </p>
          </header>

          {showSessionCard ? (
            <div className="space-y-5">
              <p className="text-sm text-foreground">
                {login.continueAs.replace('{name}', displayName)}
              </p>
              <Button
                type="button"
                variant="primary"
                loading={loading}
                className="w-full"
                onClick={handleContinue}
              >
                {loading ? login.continuing : login.continue}
              </Button>
              <Button
                type="button"
                variant="secondary"
                loading={signingOut}
                className="w-full"
                onClick={handleSignOutAndSwitch}
              >
                {signingOut ? login.signingOut : login.signOutAndSwitch}
              </Button>
              <div className="min-h-[2.5rem] text-sm" role="alert" aria-live="polite">
                {error ? (
                  <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
                    {error}
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
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
                <PasswordInput
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  showPasswordLabel={login.showPassword}
                  hidePasswordLabel={login.hidePassword}
                />
              </FormField>

              <div className="min-h-[2.5rem] text-sm" role="alert" aria-live="polite">
                {error ? (
                  <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
                    {error}
                  </p>
                ) : null}
              </div>

              <Button type="submit" variant="primary" loading={loading} className="w-full">
                {submitLabel}
              </Button>
            </form>
          )}
        </div>

        <div className="login-page-below">
          <p className="login-footer">
            {isRtl ? (
              <>
                {login.footerDevelopedBy}{' '}
                <a
                  href={SPC_WEBSITE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="login-footer-link"
                >
                  {login.spcLinkLabel}
                </a>
              </>
            ) : (
              <>
                {login.footerDevelopedBy}{' '}
                <a
                  href={SPC_WEBSITE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="login-footer-link"
                >
                  {login.spcLinkLabel}
                </a>
                {login.footerTeamSuffix}
              </>
            )}
          </p>
          <p className="login-version">{login.version}</p>
        </div>
      </div>
    </div>
  );
}
