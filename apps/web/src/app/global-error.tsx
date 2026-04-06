'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error:', error);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#fafaf9' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{ textAlign: 'center', maxWidth: '28rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1c1917', marginBottom: '0.5rem' }}>
              حدث خطأ غير متوقع
            </h1>
            <p style={{ color: '#78716c', marginBottom: '0.25rem' }}>
              Something went wrong
            </p>
            <p style={{ fontSize: '0.875rem', color: '#a8a29e', marginBottom: '2rem' }}>
              Please try refreshing the page.
            </p>
            <button
              onClick={reset}
              style={{
                background: '#474099', color: '#fff', border: 'none', borderRadius: '0.75rem',
                padding: '0.75rem 1.5rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                marginRight: '0.5rem',
              }}
            >
              Try Again
            </button>
            <a
              href="/"
              style={{
                display: 'inline-block', borderRadius: '0.75rem', padding: '0.75rem 1.5rem',
                fontSize: '0.875rem', fontWeight: 600, color: '#1c1917', textDecoration: 'none',
                border: '1px solid #e7e5e4',
              }}
            >
              Go Home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
