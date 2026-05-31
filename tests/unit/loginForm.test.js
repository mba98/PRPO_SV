import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getDictionary } from '@/lib/i18n';

describe('LoginForm — button contrast and password toggle', () => {
  it('login button renders English and Arabic sign-in labels', () => {
    expect(getDictionary('en').login.signIn).toBe('Sign in');
    expect(getDictionary('ar').login.signIn).toBe('تسجيل الدخول');
    expect(getDictionary('en').login.signingIn).toBe('Signing in...');
    expect(getDictionary('ar').login.signingIn).toBe('جاري الدخول...');
  });

  it('LoginForm uses login.signIn and shows loading text', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'app/login/LoginForm.jsx'),
      'utf8',
    );
    expect(src).toContain('login.signIn');
    expect(src).toContain('login.signingIn');
    expect(src).toContain('submitLabel');
    expect(src).toContain('loading={loading}');
  });

  it('primary button uses text-primary-foreground', () => {
    const btn = fs.readFileSync(
      path.resolve(process.cwd(), 'components/ui/Button.jsx'),
      'utf8',
    );
    const css = fs.readFileSync(path.resolve(process.cwd(), 'app/globals.css'), 'utf8');
    expect(btn).toContain('text-primary-foreground');
    expect(css).toContain('.btn-primary');
    expect(css).toContain('color: var(--primary-foreground)');
  });

  it('PasswordInput defaults to password type and toggles visibility', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'components/ui/PasswordInput.jsx'),
      'utf8',
    );
    expect(src).toContain("showPassword ? 'text' : 'password'");
    expect(src).toContain('useState(false)');
    expect(src).toContain('password-toggle-btn');
    expect(src).toContain('password-toggle-btn');
    const css = fs.readFileSync(path.resolve(process.cwd(), 'app/globals.css'), 'utf8');
    expect(css).toContain('.password-toggle-btn');
  });

  it('password toggle has bilingual aria labels', () => {
    const en = getDictionary('en');
    const ar = getDictionary('ar');
    expect(en.login.showPassword).toBe('Show password');
    expect(en.login.hidePassword).toBe('Hide password');
    expect(ar.login.showPassword).toBe('إظهار كلمة المرور');
    expect(ar.login.hidePassword).toBe('إخفاء كلمة المرور');
    const form = fs.readFileSync(
      path.resolve(process.cwd(), 'app/login/LoginForm.jsx'),
      'utf8',
    );
    expect(form).toContain('showPasswordLabel={login.showPassword}');
    expect(form).toContain('hidePasswordLabel={login.hidePassword}');
  });

  it('LoginForm wires PasswordInput with pe-12 padding class', () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), 'app/globals.css'), 'utf8');
    expect(css).toContain('.input-field-password');
    expect(css).toContain('pe-12');
  });

  it('LoginForm shows portal label, mode logos, footer, and version', () => {
    const form = fs.readFileSync(
      path.resolve(process.cwd(), 'app/login/LoginForm.jsx'),
      'utf8',
    );
    const css = fs.readFileSync(path.resolve(process.cwd(), 'app/globals.css'), 'utf8');
    expect(form).toContain('login-card-eyebrow');
    expect(form).toContain('{common.appName}');
    expect(form).toContain('svnewlogo-light1.png');
    expect(form).toContain('svnewlogo-dark1.png');
    expect(form).toContain('login-card-logo--light');
    expect(form).toContain('login-card-logo--dark');
    expect(form).toContain('login-page-stack');
    expect(form).toContain('login-page-below');
    expect(form).toContain('login.version');
    expect(css).toContain('.login-page');
    expect(css).toMatch(/flex-col/);
    const en = getDictionary('en');
    expect(en.login.version).toBe('v.1.0.0');
    expect(form).toContain('https://www.spc-it.com.iq/');
    expect(form).toContain('noopener noreferrer');
    expect(form).not.toMatch(/<h1[^>]*>\s*\{common\.appName\}/);
  });

  it('LoginForm supports continue-as and sign-out UX', () => {
    const form = fs.readFileSync(
      path.resolve(process.cwd(), 'app/login/LoginForm.jsx'),
      'utf8',
    );
    expect(form).toContain('sessionUser');
    expect(form).toContain('login.continue');
    expect(form).toContain('login.signOutAndSwitch');
    expect(getDictionary('en').login.continueAs).toContain('{name}');
  });
});
