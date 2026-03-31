'use client';

import { useAuth } from '@kunacademy/auth';
import { createBrowserClient } from '@kunacademy/db';
import { Section } from '@kunacademy/ui/section';
import { Card } from '@kunacademy/ui/card';
import { useState, useEffect, use, useCallback } from 'react';

interface CertificateRow {
  id: string;
  enrollment_id: string;
  verification_code: string;
  issued_at: string;
  pdf_url: string | null;
  course_title_ar?: string;
  course_title_en?: string;
}

export default function CertificatesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const isAr = locale === 'ar';
  const { user } = useAuth();
  const [certificates, setCertificates] = useState<CertificateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const supabase = createBrowserClient();

    async function load() {
      // Get certificates
      const { data: certs } = await supabase
        .from('certificates')
        .select('id, enrollment_id, verification_code, issued_at, pdf_url')
        .eq('user_id', user!.id)
        .order('issued_at', { ascending: false });

      if (!certs?.length) {
        setLoading(false);
        return;
      }

      // Get enrollment -> course mapping
      const enrollmentIds = certs.map((c: any) => c.enrollment_id);
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('id, course_id')
        .in('id', enrollmentIds);

      const courseIds = [...new Set((enrollments ?? []).map((e: any) => e.course_id))];
      const { data: courses } = await supabase
        .from('courses')
        .select('id, title_ar, title_en')
        .in('id', courseIds);

      // Map course titles to certificates
      const enriched = certs.map((cert: any) => {
        const enrollment = (enrollments ?? []).find((e: any) => e.id === cert.enrollment_id);
        const course = enrollment ? (courses ?? []).find((c: any) => c.id === enrollment.course_id) : null;
        return {
          ...cert,
          course_title_ar: course?.title_ar ?? '',
          course_title_en: course?.title_en ?? '',
        };
      });

      setCertificates(enriched);
      setLoading(false);
    }

    load();
  }, [user]);

  const handleGeneratePDF = useCallback(async (certId: string) => {
    setGeneratingId(certId);
    try {
      const supabase = createBrowserClient();
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) return;

      const res = await fetch('/api/certificates/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ certificate_id: certId }),
      });

      if (res.ok) {
        const { pdf_url } = await res.json();
        setCertificates((prev) =>
          prev.map((c) => (c.id === certId ? { ...c, pdf_url } : c))
        );
      }
    } catch (e) {
      console.error('[certificates] PDF generation failed:', e);
    } finally {
      setGeneratingId(null);
    }
  }, []);

  return (
    <Section variant="white">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">
        {isAr ? 'شهاداتي' : 'My Certificates'}
      </h1>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
        </div>
      ) : certificates.length > 0 ? (
        <div className="space-y-4">
          {certificates.map((cert) => (
            <Card key={cert.id} accent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-[var(--text-primary)]">
                    {isAr ? cert.course_title_ar : cert.course_title_en}
                  </h3>
                  <p className="text-sm text-[var(--color-neutral-500)] mt-1">
                    {isAr ? 'صدرت في' : 'Issued'} {new Date(cert.issued_at).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                  <p className="text-xs text-[var(--color-neutral-400)] mt-0.5 font-mono">
                    {isAr ? 'رمز التحقق:' : 'Verification:'} {cert.verification_code}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Download PDF — shown when pdf_url exists */}
                  {cert.pdf_url && (
                    <a
                      href={cert.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="inline-flex items-center px-3 py-2 rounded-lg bg-[var(--color-primary)] text-sm text-white hover:opacity-90 transition-opacity min-h-[44px]"
                    >
                      <svg className="w-4 h-4 ltr:mr-1.5 rtl:ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      {isAr ? 'تحميل PDF' : 'Download PDF'}
                    </a>
                  )}

                  {/* Generate Certificate button — shown when no pdf_url */}
                  {!cert.pdf_url && (
                    <button
                      onClick={() => handleGeneratePDF(cert.id)}
                      disabled={generatingId === cert.id}
                      className="inline-flex items-center px-3 py-2 rounded-lg border border-[var(--color-primary)] text-sm text-[var(--color-primary)] hover:bg-[var(--color-primary-50)] transition-colors min-h-[44px] disabled:opacity-50"
                    >
                      {generatingId === cert.id ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent ltr:mr-1.5 rtl:ml-1.5" />
                          {isAr ? 'جاري التوليد...' : 'Generating...'}
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 ltr:mr-1.5 rtl:ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          {isAr ? 'توليد الشهادة' : 'Generate Certificate'}
                        </>
                      )}
                    </button>
                  )}

                  {/* Verify link */}
                  <a
                    href={`/${locale}/verify?code=${cert.verification_code}`}
                    className="inline-flex items-center px-3 py-2 rounded-lg border border-[var(--color-neutral-200)] text-sm text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-50)] transition-colors min-h-[44px]"
                  >
                    <svg className="w-4 h-4 ltr:mr-1.5 rtl:ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                    {isAr ? 'تحقق' : 'Verify'}
                  </a>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-[var(--color-primary-50)] flex items-center justify-center">
            <svg className="w-7 h-7 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{isAr ? 'لا توجد شهادات بعد' : 'No certificates yet'}</h2>
          <p className="text-sm text-[var(--color-neutral-500)] mt-2 mb-6">
            {isAr ? 'أكمل دورة أو برنامج للحصول على شهادتك' : 'Complete a course or program to earn your certificate'}
          </p>
          <a href={`/${locale}/academy`} className="inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white min-h-[44px]">
            {isAr ? 'تصفّح البرامج' : 'Browse Programs'}
          </a>
        </div>
      )}
    </Section>
  );
}
