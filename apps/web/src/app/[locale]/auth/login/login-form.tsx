'use client';

import { useState } from 'react';
import { Button } from '@kunacademy/ui/button';
import { signIn } from 'next-auth/react';

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

type AuthMethod = 'password' | 'magic-link';

export function LoginForm({ locale, mode = 'login' }: { locale: string; mode?: 'login' | 'signup' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('password');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const isAr = locale === 'ar';

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');
    try {
      if (mode === 'signup') {
        // Auth.js has no built-in signup — call our API route
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, locale }),
        });
        const body = await res.json();
        if (!res.ok) {
          throw new Error(body.error || 'signup_failed');
        }
        // Auto sign-in after successful signup
        const result = await signIn('credentials', { email, password, redirect: false });
        if (result?.error) throw new Error('Invalid login credentials');
        const params = new URLSearchParams(window.location.search);
        const redirect = params.get('redirect') || `/${locale}/dashboard`;
        window.location.href = redirect;
      } else {
        const result = await signIn('credentials', { email, password, redirect: false });
        if (result?.error) throw new Error('Invalid login credentials');
        // Full page reload so middleware picks up the new auth cookies
        const params = new URLSearchParams(window.location.search);
        const redirect = params.get('redirect') || `/${locale}/dashboard`;
        window.location.href = redirect;
      }
    } catch (err: any) {
      setStatus('error');
      const msg = err?.message || '';
      if (msg.includes('Invalid login') || msg.includes('CredentialsSignin')) {
        setErrorMessage(isAr ? 'البريد أو كلمة المرور غير صحيحة' : 'Invalid email or password');
      } else if (msg.includes('already registered') || msg.includes('409')) {
        setErrorMessage(isAr ? 'هذا البريد مسجّل بالفعل' : 'This email is already registered');
      } else {
        setErrorMessage(isAr ? 'حدث خطأ. حاول مرة أخرى.' : 'An error occurred. Please try again.');
      }
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');
    try {
      const result = await signIn('email', { email, redirect: false });
      if (result?.error) throw new Error(result.error);
      setStatus('sent');
    } catch {
      setStatus('error');
      setErrorMessage(isAr ? 'حدث خطأ. حاول مرة أخرى.' : 'An error occurred. Please try again.');
    }
  }

  async function handleGoogleLogin() {
    try {
      const params = new URLSearchParams(window.location.search);
      const redirectUrl = params.get('redirect') || `/${locale}/dashboard`;
      await signIn('google', { callbackUrl: redirectUrl });
    } catch {
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <div className="mt-8 rounded-lg bg-green-50 p-6 text-center">
        <p className="text-green-800 font-medium">
          {authMethod === 'magic-link'
            ? (isAr ? 'تم إرسال رابط الدخول!' : 'Login link sent!')
            : (isAr ? 'تحقّق من بريدك لتأكيد الحساب' : 'Check your email to confirm your account')}
        </p>
        <p className="mt-2 text-green-700 text-sm">
          {isAr ? `تحقّق من بريدك ${email}` : `Check your email at ${email}`}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <button
        type="button"
        onClick={handleGoogleLogin}
        aria-label={isAr ? 'الدخول عبر Google' : 'Continue with Google'}
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-[var(--color-neutral-300)] bg-white px-4 py-3 text-base font-medium text-[var(--color-neutral-700)] transition-colors hover:bg-[var(--color-neutral-50)] min-h-[44px]"
      >
        <GoogleIcon />
        {isAr ? 'الدخول عبر Google' : 'Continue with Google'}
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[var(--color-neutral-200)]" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-4 text-[var(--color-neutral-500)]">
            {isAr ? 'أو' : 'or'}
          </span>
        </div>
      </div>

      <form onSubmit={authMethod === 'password' ? handlePasswordLogin : handleMagicLink} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-[var(--color-neutral-700)]">
            {isAr ? 'البريد الإلكتروني' : 'Email address'}
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 text-base focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-opacity-20 min-h-[44px]"
            placeholder="your@email.com"
            dir="ltr"
          />
        </div>

        {authMethod === 'password' && (
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[var(--color-neutral-700)]">
              {isAr ? 'كلمة المرور' : 'Password'}
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 text-base focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-opacity-20 min-h-[44px]"
              placeholder={isAr ? 'كلمة المرور' : 'Password'}
              dir="ltr"
              minLength={6}
            />
          </div>
        )}

        {status === 'error' && (
          <p className="text-red-600 text-sm">
            {errorMessage || (isAr ? 'حدث خطأ. حاول مرة أخرى.' : 'An error occurred. Please try again.')}
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={status === 'loading'}>
          {status === 'loading'
            ? (isAr ? 'جاري الدخول...' : 'Signing in...')
            : authMethod === 'password'
              ? (mode === 'signup'
                ? (isAr ? 'إنشاء حساب' : 'Create Account')
                : (isAr ? 'تسجيل الدخول' : 'Sign In'))
              : (isAr ? 'أرسل رابط الدخول' : 'Send Login Link')}
        </Button>
      </form>

      {/* Toggle between password and magic link */}
      <button
        type="button"
        onClick={() => {
          setAuthMethod(authMethod === 'password' ? 'magic-link' : 'password');
          setStatus('idle');
          setErrorMessage('');
        }}
        aria-label={authMethod === 'password'
          ? (isAr ? 'التبديل إلى رابط الدخول بدون كلمة مرور' : 'Switch to magic link sign-in (no password required)')
          : (isAr ? 'التبديل إلى تسجيل الدخول بكلمة المرور' : 'Switch to email and password sign-in')}
        className="w-full text-center text-sm text-[var(--color-neutral-500)] hover:text-[var(--color-primary)] transition-colors"
      >
        {authMethod === 'password'
          ? (isAr ? 'أو أرسل رابط دخول بدون كلمة مرور' : 'Or sign in with a magic link instead')
          : (isAr ? 'أو سجّل دخول بكلمة المرور' : 'Or sign in with email & password')}
      </button>

      <p className="text-center text-sm text-[var(--color-neutral-500)]">
        {mode === 'login' ? (
          <>
            {isAr ? 'ليس لديك حساب؟' : "Don't have an account?"}{' '}
            <a href={`/${locale}/auth/signup`} className="text-[var(--color-primary)] font-medium hover:underline">
              {isAr ? 'إنشاء حساب' : 'Create one'}
            </a>
          </>
        ) : (
          <>
            {isAr ? 'لديك حساب بالفعل؟' : 'Already have an account?'}{' '}
            <a href={`/${locale}/auth/login`} className="text-[var(--color-primary)] font-medium hover:underline">
              {isAr ? 'تسجيل الدخول' : 'Sign in'}
            </a>
          </>
        )}
      </p>
    </div>
  );
}
