'use client';

import { useState, useEffect } from 'react';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function ResetPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const [locale, setLocale] = useState('ar');
  useEffect(() => { params.then(p => setLocale(p.locale)); }, [params]);
  const isAr = locale === 'ar';

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus('loading');
    setErrorMessage('');

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Request failed');
      }
      setStatus('sent');
    } catch (err: unknown) {
      setStatus('error');
      setErrorMessage(
        err instanceof Error && err.message !== 'Request failed'
          ? err.message
          : (isAr ? 'حدث خطأ. حاول مرة أخرى.' : 'An error occurred. Please try again.')
      );
    }
  }

  if (status === 'sent') {
    return (
      <main>
        <div className="min-h-[70vh] flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
              {isAr ? 'تحقّق من بريدك الإلكتروني' : 'Check your email'}
            </h1>
            <p className="text-sm text-[var(--color-neutral-500)] mb-6">
              {isAr
                ? `إذا كان هناك حساب مرتبط بـ ${email}، فسنرسل لك رابط إعادة تعيين كلمة المرور.`
                : `If an account exists for ${email}, we've sent a password reset link.`}
            </p>
            <Link
              href={`/${locale}/auth/login`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] text-white font-semibold px-6 py-3 min-h-[44px] hover:opacity-90 transition-opacity"
            >
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
              {isAr ? 'العودة لتسجيل الدخول' : 'Back to sign in'}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full" dir={isAr ? 'rtl' : 'ltr'}>
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-[var(--color-primary-50)] flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-[var(--color-primary)]" />
            </div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">
              {isAr ? 'نسيت كلمة المرور؟' : 'Forgot your password?'}
            </h1>
            <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
              {isAr
                ? 'أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين.'
                : "Enter your email and we'll send you a reset link."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="reset-email" className="block text-sm font-medium text-[var(--color-neutral-700)] mb-1">
                {isAr ? 'البريد الإلكتروني' : 'Email address'}
              </label>
              <input
                id="reset-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-neutral-200)] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] min-h-[44px]"
                placeholder="you@example.com"
                dir="ltr"
              />
            </div>

            {status === 'error' && (
              <p className="text-red-600 text-sm" role="alert">{errorMessage}</p>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] text-white font-semibold px-6 py-3 min-h-[44px] hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {status === 'loading'
                ? (isAr ? 'جاري الإرسال...' : 'Sending...')
                : (isAr ? 'إرسال رابط إعادة التعيين' : 'Send Reset Link')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href={`/${locale}/auth/login`}
              className="inline-flex items-center gap-1 text-sm text-[var(--color-neutral-500)] hover:text-[var(--color-primary)] transition-colors min-h-[44px]"
            >
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
              {isAr ? 'العودة لتسجيل الدخول' : 'Back to sign in'}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
