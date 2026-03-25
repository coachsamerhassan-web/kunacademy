'use client';

import { useState } from 'react';
import { Button } from '@kunacademy/ui/button';
import { createBrowserClient } from '@kunacademy/db';

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

export function LoginForm({ locale, mode = 'login' }: { locale: string; mode?: 'login' | 'signup' }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const isAr = locale === 'ar';

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    try {
      const supabase = createBrowserClient();
      if (!supabase) throw new Error('Supabase not configured');
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/${locale}/auth/callback` },
      });
      if (error) throw error;
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  }

  async function handleGoogleLogin() {
    try {
      const supabase = createBrowserClient();
      if (!supabase) throw new Error('Supabase not configured');
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/${locale}/auth/callback`,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });
    } catch {
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <div className="mt-8 rounded-lg bg-green-50 p-6 text-center">
        <p className="text-green-800 font-medium">
          {isAr ? 'تم إرسال رابط الدخول!' : 'Login link sent!'}
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

      <form onSubmit={handleMagicLink} className="space-y-4">
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
        {status === 'error' && (
          <p className="text-red-600 text-sm">
            {isAr ? 'حدث خطأ. حاول مرة أخرى.' : 'An error occurred. Please try again.'}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={status === 'loading'}>
          {status === 'loading'
            ? (isAr ? 'جاري الإرسال...' : 'Sending...')
            : (isAr ? 'أرسل رابط الدخول' : 'Send Login Link')}
        </Button>
      </form>

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
