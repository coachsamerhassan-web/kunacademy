'use client';

import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Card } from '@kunacademy/ui/card';
import { useState, useEffect, use, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

interface VerificationResult {
  valid: boolean;
  name_ar?: string;
  name_en?: string;
  course_ar?: string;
  course_en?: string;
  issued_at?: string;
  verification_code?: string;
}

export default function VerifyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  return (
    <Suspense fallback={<div className="py-20 text-center"><div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" /></div>}>
      <VerifyContent locale={locale} />
    </Suspense>
  );
}

function VerifyContent({ locale }: { locale: string }) {
  const isAr = locale === 'ar';
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get('code') ?? '';

  const [code, setCode] = useState(codeFromUrl);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (codeFromUrl) verify(codeFromUrl);
  }, [codeFromUrl]);

  async function verify(verifyCode: string) {
    if (!verifyCode.trim()) return;
    setLoading(true);
    setSearched(true);

    const res = await fetch('/api/lms/certificate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: verifyCode.trim() }),
    });

    if (res.ok) {
      const data = await res.json();
      setResult(data);
    } else {
      setResult({ valid: false });
    }
    setLoading(false);
  }

  return (
    <main>
      <section className="relative overflow-hidden py-12 md:py-20 bg-[var(--color-background)]">
        <GeometricPattern pattern="flower-of-life" opacity={0.3} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h1
            className="text-[2.25rem] md:text-[3rem] font-bold text-[var(--text-primary)]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'تحقّق من الشهادة' : 'Verify Certificate'}
          </h1>
          <p className="mt-3 text-[var(--text-muted)] max-w-md mx-auto">
            {isAr
              ? 'أدخل رمز التحقق للتأكد من صلاحية الشهادة'
              : 'Enter the verification code to validate a certificate'}
          </p>
        </div>
      </section>

      <Section variant="white">
        <div className="max-w-md mx-auto">
          {/* Search form */}
          <div className="flex gap-3 mb-8">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={isAr ? 'رمز التحقق...' : 'Verification code...'}
              className="flex-1 rounded-xl border border-[var(--color-neutral-200)] px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              onKeyDown={(e) => e.key === 'Enter' && verify(code)}
              dir="ltr"
            />
            <button
              onClick={() => verify(code)}
              disabled={loading || !code.trim()}
              className="rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white min-h-[48px] disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {loading ? '...' : (isAr ? 'تحقق' : 'Verify')}
            </button>
          </div>

          {/* Result */}
          {searched && result && (
            result.valid ? (
              <Card accent className="p-6 text-center">
                <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-green-700 mb-4">
                  {isAr ? 'شهادة صالحة' : 'Valid Certificate'}
                </h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-2 border-b border-[var(--color-neutral-100)]">
                    <span className="text-[var(--color-neutral-500)]">{isAr ? 'الاسم' : 'Name'}</span>
                    <span className="font-medium">{isAr ? result.name_ar : result.name_en}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-[var(--color-neutral-100)]">
                    <span className="text-[var(--color-neutral-500)]">{isAr ? 'الدورة' : 'Course'}</span>
                    <span className="font-medium">{isAr ? result.course_ar : result.course_en}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-[var(--color-neutral-100)]">
                    <span className="text-[var(--color-neutral-500)]">{isAr ? 'تاريخ الإصدار' : 'Issued'}</span>
                    <span className="font-medium">
                      {result.issued_at && new Date(result.issued_at).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-[var(--color-neutral-500)]">{isAr ? 'رمز التحقق' : 'Code'}</span>
                    <span className="font-mono text-xs">{result.verification_code}</span>
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="p-6 text-center">
                <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-red-600">
                  {isAr ? 'رمز غير صالح' : 'Invalid Code'}
                </h2>
                <p className="text-sm text-[var(--color-neutral-500)] mt-2">
                  {isAr ? 'تأكد من إدخال الرمز بشكل صحيح' : 'Please check the code and try again'}
                </p>
              </Card>
            )
          )}
        </div>
      </Section>
    </main>
  );
}
