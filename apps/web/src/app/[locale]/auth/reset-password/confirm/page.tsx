'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Lock, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';

function ResetConfirmInner({ locale }: { locale: string }) {
  const isAr = locale === 'ar';
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'invalid'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // If no token in URL, show invalid state immediately
  useEffect(() => {
    if (!token) setStatus('invalid');
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password.length < 6) {
      setErrorMessage(isAr ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters');
      setStatus('error');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage(isAr ? 'كلمات المرور غير متطابقة' : 'Passwords do not match');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    try {
      const res = await fetch('/api/auth/reset-password/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Reset failed');
      }
      setStatus('success');
    } catch (err: unknown) {
      setStatus('error');
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Invalid or expired')) {
        setErrorMessage(isAr
          ? 'الرابط غير صالح أو منتهي الصلاحية. اطلب رابطًا جديدًا.'
          : 'Invalid or expired link. Please request a new one.');
      } else {
        setErrorMessage(isAr ? 'حدث خطأ. حاول مرة أخرى.' : 'An error occurred. Please try again.');
      }
    }
  }

  if (status === 'invalid') {
    return (
      <div className="max-w-md mx-auto text-center py-16 px-4" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
          {isAr ? 'رابط غير صالح' : 'Invalid Link'}
        </h1>
        <p className="text-sm text-[var(--color-neutral-500)] mb-6">
          {isAr
            ? 'هذا الرابط منتهي الصلاحية أو غير صحيح.'
            : 'This link is expired or invalid.'}
        </p>
        <Link
          href={`/${locale}/auth/reset-password`}
          className="inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] text-white font-semibold px-6 py-3 min-h-[44px] hover:opacity-90 transition-opacity"
        >
          {isAr ? 'اطلب رابطًا جديدًا' : 'Request a new link'}
        </Link>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="max-w-md mx-auto text-center py-16 px-4" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
          {isAr ? 'تم تغيير كلمة المرور!' : 'Password changed!'}
        </h1>
        <p className="text-sm text-[var(--color-neutral-500)] mb-6">
          {isAr
            ? 'يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.'
            : 'You can now sign in with your new password.'}
        </p>
        <Link
          href={`/${locale}/auth/login`}
          className="inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] text-white font-semibold px-6 py-3 min-h-[44px] hover:opacity-90 transition-opacity"
        >
          {isAr ? 'تسجيل الدخول' : 'Sign In'}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-[var(--color-primary-50)] flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-[var(--color-primary)]" />
        </div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          {isAr ? 'كلمة مرور جديدة' : 'Set New Password'}
        </h1>
        <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
          {isAr ? 'أدخل كلمة المرور الجديدة.' : 'Enter your new password below.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="new-password" className="block text-sm font-medium text-[var(--color-neutral-700)] mb-1">
            {isAr ? 'كلمة المرور الجديدة' : 'New Password'}
          </label>
          <input
            id="new-password"
            type="password"
            required
            autoComplete="new-password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-[var(--color-neutral-200)] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] min-h-[44px]"
            placeholder={isAr ? '٦ أحرف على الأقل' : 'At least 6 characters'}
            dir="ltr"
          />
        </div>

        <div>
          <label htmlFor="confirm-password" className="block text-sm font-medium text-[var(--color-neutral-700)] mb-1">
            {isAr ? 'تأكيد كلمة المرور' : 'Confirm Password'}
          </label>
          <input
            id="confirm-password"
            type="password"
            required
            autoComplete="new-password"
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-xl border border-[var(--color-neutral-200)] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] min-h-[44px]"
            placeholder={isAr ? 'أعد إدخال كلمة المرور' : 'Re-enter password'}
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
            ? (isAr ? 'جاري التحديث...' : 'Updating...')
            : (isAr ? 'تعيين كلمة المرور' : 'Set Password')}
        </button>
      </form>
    </div>
  );
}

export default function ResetConfirmPage({ params }: { params: Promise<{ locale: string }> }) {
  const [locale, setLocale] = useState('ar');
  useEffect(() => { params.then(p => setLocale(p.locale)); }, [params]);
  return (
    <main>
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
        </div>
      }>
        <ResetConfirmInner locale={locale} />
      </Suspense>
    </main>
  );
}
