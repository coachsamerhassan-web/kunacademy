'use client';

/**
 * Root-level route-segment error boundary.
 *
 * Catches unhandled runtime errors in any route that is NOT wrapped by a
 * more-specific error.tsx (e.g. the [locale]/error.tsx already handles
 * locale-aware routes). This page fires for paths like /api/*, /sitemap*,
 * or any future root-segment route that doesn't match a locale prefix.
 *
 * Locale detection: attempts to read the first path segment; falls back to 'en'.
 */

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const isAr = pathname?.startsWith('/ar') ?? false;

  // Non-PII guard: surface message only if it looks safe (no emails, IDs, paths)
  const safeMessage = (() => {
    const msg = error?.message ?? '';
    const looksLikeUserData = /[@/\\]|[0-9a-f]{8}-[0-9a-f]{4}/i.test(msg);
    return looksLikeUserData ? null : msg || null;
  })();

  useEffect(() => {
    // Log to console; a monitoring service hook can pick this up
    console.error('[RootError]', error?.digest ?? '', error);
  }, [error]);

  return (
    <section
      dir={isAr ? 'rtl' : 'ltr'}
      className="min-h-[60vh] flex items-center justify-center py-16 px-4"
    >
      <div className="text-center max-w-lg mx-auto">
        {/* Icon */}
        <div className="mx-auto mb-6 w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
          <svg
            className="w-7 h-7 text-red-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        {/* Heading */}
        <h1
          className="text-2xl md:text-3xl font-bold text-[var(--color-neutral-900)] mb-2"
        >
          {isAr ? 'حدث خطأ غير متوقع' : 'Something went wrong'}
        </h1>
        <p className="text-[var(--color-neutral-500)] mb-1">
          {isAr ? 'Something went wrong' : 'حدث خطأ غير متوقع'}
        </p>

        {/* Safe error detail */}
        {safeMessage && (
          <p className="mt-2 text-xs text-[var(--color-neutral-400)] font-mono break-words mb-2">
            {safeMessage}
          </p>
        )}

        <p className="text-sm text-[var(--color-neutral-400)] mb-8">
          {isAr
            ? 'يرجى تحديث الصفحة أو العودة إلى الرئيسية.'
            : 'Please try again or return to the home page.'}
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white min-h-[48px] hover:opacity-90 transition-opacity"
          >
            {isAr ? 'حاول مجدداً' : 'Try Again'}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-[var(--color-neutral-200)] bg-white px-6 py-3 text-sm font-semibold text-[var(--color-neutral-900)] min-h-[48px] hover:bg-[var(--color-neutral-50)] transition-colors"
          >
            {isAr ? 'العودة للرئيسية' : 'Go Home'}
          </a>
        </div>
      </div>
    </section>
  );
}
