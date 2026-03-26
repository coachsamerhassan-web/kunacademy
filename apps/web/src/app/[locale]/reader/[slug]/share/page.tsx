'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@kunacademy/auth';

export default function SharePage({
  params: { locale, slug },
}: {
  params: { locale: string; slug: string };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { user, isLoading } = useAuth();

  const [status, setStatus] = useState<'loading' | 'granting' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isLoading) return;

    if (!token) {
      setStatus('error');
      setErrorMsg('Invalid share link — no token provided');
      return;
    }

    // If not authenticated, redirect to login with return URL
    if (!user) {
      const returnUrl = `/reader/${slug}/share?token=${token}`;
      router.push(`/${locale}/auth/signin?returnUrl=${encodeURIComponent(returnUrl)}`);
      return;
    }

    // User is authenticated — grant access using the token
    grantAccess();
  }, [isLoading, user, token, slug, locale, router]);

  async function grantAccess() {
    try {
      setStatus('granting');

      const res = await fetch(`/api/books/${slug}/share/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to grant access');
      }

      setStatus('success');

      // Redirect to reader after 2 seconds
      setTimeout(() => {
        router.push(`/${locale}/reader/${slug}`);
      }, 2000);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Failed to grant access');
    }
  }

  const isAr = locale === 'ar';

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)] px-4">
      <div className="max-w-md text-center">
        {status === 'loading' && (
          <div>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)] mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">
              {isAr ? 'جاري التحقق...' : 'Verifying access...'}
            </h1>
          </div>
        )}

        {status === 'granting' && (
          <div>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)] mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">
              {isAr ? 'جاري منح الوصول...' : 'Granting access...'}
            </h1>
          </div>
        )}

        {status === 'success' && (
          <div>
            <div className="text-5xl mb-4">✓</div>
            <h1 className="text-2xl font-semibold text-green-600 mb-2">
              {isAr ? 'تم! تم منح الوصول' : 'Success! Access granted'}
            </h1>
            <p className="text-gray-600 mb-4">
              {isAr ? 'جاري التحويل إلى الكتاب...' : 'Redirecting to the book...'}
            </p>
          </div>
        )}

        {status === 'error' && (
          <div>
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-2xl font-semibold text-red-600 mb-2">
              {isAr ? 'خطأ' : 'Error'}
            </h1>
            <p className="text-gray-600 mb-6">{errorMsg}</p>
            <button
              onClick={() => router.push(`/${locale}/reader/${slug}`)}
              className="px-6 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90"
            >
              {isAr ? 'العودة إلى الكتاب' : 'Back to book'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
