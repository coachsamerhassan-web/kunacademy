'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Page error:', error);
  }, [error]);

  return (
    <section className="min-h-[60vh] flex items-center justify-center py-16">
      <div className="text-center px-4 max-w-lg mx-auto">
        <div className="mx-auto mb-6 w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
          <svg className="w-7 h-7 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h1
          className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-3"
          style={{ fontFamily: 'var(--font-arabic-heading)' }}
        >
          حدث خطأ
        </h1>
        <p className="text-[var(--color-neutral-500)] mb-2">
          Something went wrong
        </p>
        <p className="text-sm text-[var(--color-neutral-400)] mb-8">
          An unexpected error occurred. Please try again.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white min-h-[48px] hover:opacity-90 transition-opacity"
          >
            Try Again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-[var(--color-neutral-200)] bg-white px-6 py-3 text-sm font-semibold text-[var(--text-primary)] min-h-[48px] hover:bg-[var(--color-neutral-50)] transition-colors"
          >
            Go Home
          </a>
        </div>
      </div>
    </section>
  );
}
