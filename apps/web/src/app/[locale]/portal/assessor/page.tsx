'use client';

/**
 * Assessor Queue — /portal/assessor
 *
 * Lists all recordings assigned to the current assessor (decision = 'pending').
 * Clicking a row opens the Assessor Workspace for that assignment.
 *
 * Role gate: enforced in middleware (assessor path) + re-checked here.
 * Sub-phase: S2-Layer-1 / 2.1 — Assessor Workspace UI
 *
 * SLA Badge: Uses businessDaysBetween() to calculate 10-business-day threshold.
 * Matches backend convention in assessment-sla-check cron.
 */

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { businessDaysBetween } from '@/lib/business-days';

interface QueueItem {
  assessment_id: string;
  recording_id: string;
  package_instance_id: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  duration_seconds: number | null;
  recording_status: string;
  submitted_at: string;
  assigned_at: string;
  decision: string;
  student_name_en: string | null;
  student_name_ar: string | null;
  student_email: string;
}

const ASSESSOR_ROLES = ['admin', 'super_admin', 'mentor_manager', 'provider'];

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function slaBadge(submittedAt: string, isAr: boolean) {
  const businessDaysElapsed = businessDaysBetween(new Date(submittedAt), new Date());
  const remaining = 10 - businessDaysElapsed;

  // Red: 0-2 business days remaining
  if (remaining <= 2) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        {isAr ? `${remaining} أيام` : `${remaining}d left`}
      </span>
    );
  }
  // Amber: 3-5 business days remaining
  if (remaining <= 5) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
        {isAr ? `${remaining} أيام` : `${remaining}d left`}
      </span>
    );
  }
  // Green: >5 business days remaining
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
      {isAr ? `${remaining} أيام` : `${remaining}d left`}
    </span>
  );
}

export default function AssessorQueuePage() {
  const { locale } = useParams<{ locale: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const isAr = locale === 'ar';

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    fetch('/api/assessments/my-queue')
      .then((r) => {
        if (!r.ok) {
          return r.json().then((d) => { throw new Error(d.error || 'Failed to load queue'); });
        }
        return r.json();
      })
      .then((data) => {
        setQueue(data.queue || []);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [user]);

  if (authLoading) {
    return (
      <Section variant="white">
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      </Section>
    );
  }

  if (!user) {
    return (
      <Section variant="white">
        <div className="text-center py-16">
          <p className="text-[var(--color-neutral-500)]">
            {isAr ? 'يرجى تسجيل الدخول' : 'Please sign in'}
          </p>
          <a
            href={`/${locale}/auth/login?redirect=/${locale}/portal/assessor`}
            className="mt-3 inline-block text-[var(--color-primary)] font-medium hover:underline"
          >
            {isAr ? 'تسجيل الدخول' : 'Sign in'}
          </a>
        </div>
      </Section>
    );
  }

  if (!ASSESSOR_ROLES.includes(user.role ?? '')) {
    return (
      <Section variant="white">
        <div className="text-center py-16">
          <p className="text-[var(--color-neutral-500)]">
            {isAr ? 'غير مصرح لك بالوصول' : 'Access denied'}
          </p>
        </div>
      </Section>
    );
  }

  if (error) {
    return (
      <Section variant="white">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {isAr ? `خطأ: ${error}` : `Error: ${error}`}
        </div>
      </Section>
    );
  }

  return (
    <main dir={isAr ? 'rtl' : 'ltr'}>
      <Section variant="white">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <Heading level={1}>
              {isAr ? 'قائمة التقييمات' : 'Assessment Queue'}
            </Heading>
            <p className="mt-1 text-sm text-[var(--color-neutral-500)]">
              {isAr
                ? 'جلسات الكوتشينج المسندة إليك للمراجعة والتقييم'
                : 'Coaching sessions assigned to you for review and assessment'}
            </p>
          </div>
          {!loading && (
            <span className="shrink-0 inline-flex items-center justify-center h-8 min-w-[2rem] rounded-full bg-[var(--color-primary)] text-white text-sm font-medium px-2.5">
              {queue.length}
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-[var(--color-neutral-100)] animate-pulse" />
            ))}
          </div>
        ) : queue.length === 0 ? (
          <div className="rounded-xl border border-[var(--color-neutral-200)] p-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-neutral-100)]">
              <svg className="h-7 w-7 text-[var(--color-neutral-400)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12l2 2 4-4" />
                <circle cx="12" cy="12" r="10" />
              </svg>
            </div>
            <p className="font-medium text-[var(--text-primary)]">
              {isAr ? 'لا توجد تقييمات معلقة' : 'No pending assessments'}
            </p>
            <p className="mt-1 text-sm text-[var(--color-neutral-500)]">
              {isAr ? 'ستظهر هنا الجلسات المسندة إليك' : 'Assigned sessions will appear here'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((item) => {
              const studentName = isAr
                ? (item.student_name_ar || item.student_name_en || item.student_email)
                : (item.student_name_en || item.student_name_ar || item.student_email);
              const assignedDate = new Date(item.assigned_at).toLocaleDateString(
                isAr ? 'ar-SA' : 'en-US',
                { year: 'numeric', month: 'short', day: 'numeric' },
              );

              return (
                <button
                  key={item.assessment_id}
                  onClick={() => router.push(`/${locale}/portal/assessor/${item.assessment_id}`)}
                  className="w-full rounded-xl border border-[var(--color-neutral-200)] p-4 text-start hover:border-[var(--color-primary)] hover:shadow-sm transition-all group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Icon */}
                    <div className="shrink-0 flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--color-neutral-100)] group-hover:bg-[var(--color-primary)]/10 transition-colors">
                      <svg className="h-5 w-5 text-[var(--color-neutral-500)] group-hover:text-[var(--color-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 19V6l12-3v13" />
                        <circle cx="6" cy="18" r="3" />
                        <circle cx="18" cy="15" r="3" />
                      </svg>
                    </div>

                    {/* Student + file */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[var(--text-primary)]">{studentName}</div>
                      <div className="mt-0.5 text-sm text-[var(--color-neutral-500)] truncate">
                        {item.original_filename}
                        {item.duration_seconds && (
                          <>
                            <span className="mx-1 text-[var(--color-neutral-300)]">·</span>
                            {formatDuration(item.duration_seconds)}
                          </>
                        )}
                        <span className="mx-1 text-[var(--color-neutral-300)]">·</span>
                        {formatBytes(item.file_size_bytes)}
                      </div>
                    </div>

                    {/* SLA + assigned */}
                    <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 shrink-0">
                      {slaBadge(item.submitted_at, isAr)}
                      <span className="text-xs text-[var(--color-neutral-400)]">
                        {isAr ? `أُسند ${assignedDate}` : `Assigned ${assignedDate}`}
                      </span>
                    </div>

                    {/* Chevron */}
                    <div className={`hidden sm:flex items-center text-[var(--color-neutral-300)] group-hover:text-[var(--color-primary)] transition-colors ${isAr ? 'rotate-180' : ''}`}>
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Section>
    </main>
  );
}
