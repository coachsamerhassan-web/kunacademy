'use client';

/**
 * Student Packages Home Page
 * /[locale]/portal/packages
 *
 * Lists all package instances enrolled by the current student.
 * Shows: package name, journey state badge, last assessment date, link to details.
 *
 * Auth: session required. Only students can view their own packages.
 * Bilingual: Arabic (RTL) + English. Mobile-first layout.
 *
 * Sub-phase: S2-Layer-1 / Student Package Listing
 */

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PackageCardData {
  instance_id: string;
  package_name: string;
  journey_state: string;
  last_assessment_date: string | null;
  expires_at: string;
}

// ── Status badge color helper ────────────────────────────────────────────────

function getStatusBadgeColor(state: string): { bg: string; text: string; label: string } {
  const stateMap: Record<string, { bg: string; text: string; label_ar: string; label_en: string }> = {
    'enrolled': { bg: 'bg-blue-50', text: 'text-blue-700', label_ar: 'قيد الانتظار', label_en: 'Pending' },
    'pending': { bg: 'bg-blue-50', text: 'text-blue-700', label_ar: 'قيد الانتظار', label_en: 'Pending' },
    'recording_submitted': { bg: 'bg-blue-50', text: 'text-blue-700', label_ar: 'تم الإرسال', label_en: 'Recording Submitted' },
    'under_assessment': { bg: 'bg-blue-50', text: 'text-blue-700', label_ar: 'قيد التقييم', label_en: 'Under Assessment' },
    'assessment_passed': { bg: 'bg-green-50', text: 'text-green-700', label_ar: 'نجح', label_en: 'Passed' },
    'assessment_failed': { bg: 'bg-amber-50', text: 'text-amber-700', label_ar: 'لم ينجح', label_en: 'Failed' },
    'second_try_pending': { bg: 'bg-blue-50', text: 'text-blue-700', label_ar: 'محاولة ثانية', label_en: 'Second Try Pending' },
    'under_escalation': { bg: 'bg-amber-50', text: 'text-amber-700', label_ar: 'قيد المراجعة', label_en: 'Under Review' },
    'paused': { bg: 'bg-purple-50', text: 'text-purple-700', label_ar: 'متوقفة', label_en: 'Paused' },
    'expired': { bg: 'bg-gray-50', text: 'text-gray-700', label_ar: 'انتهت', label_en: 'Expired' },
    'terminated': { bg: 'bg-gray-50', text: 'text-gray-700', label_ar: 'ملغاة', label_en: 'Terminated' },
  };

  const def = {
    bg: 'bg-neutral-50',
    text: 'text-neutral-700',
    label_ar: state,
    label_en: state,
  };

  return {
    bg: stateMap[state]?.bg ?? def.bg,
    text: stateMap[state]?.text ?? def.text,
    label: state === 'ar' ? stateMap[state]?.label_ar ?? def.label_ar : stateMap[state]?.label_en ?? def.label_en,
  };
}

// ── Package card component ──────────────────────────────────────────────────

interface PackageCardProps {
  data: PackageCardData;
  isAr: boolean;
  locale: string;
}

function PackageCard({ data, isAr, locale }: PackageCardProps) {
  const statusInfo = getStatusBadgeColor(data.journey_state);
  const statusLabel = isAr
    ? { 'pending': 'قيد الانتظار', 'under_assessment': 'قيد التقييم', 'assessment_passed': 'نجح', 'assessment_failed': 'لم ينجح', 'second_try_pending': 'محاولة ثانية', 'under_escalation': 'قيد المراجعة', 'paused': 'متوقفة', 'expired': 'انتهت', 'terminated': 'ملغاة', 'enrolled': 'قيد الانتظار', 'recording_submitted': 'تم الإرسال' }[data.journey_state] || data.journey_state
    : { 'pending': 'Pending', 'under_assessment': 'Under Assessment', 'assessment_passed': 'Passed', 'assessment_failed': 'Failed', 'second_try_pending': 'Second Try Pending', 'under_escalation': 'Under Review', 'paused': 'Paused', 'expired': 'Expired', 'terminated': 'Terminated', 'enrolled': 'Pending', 'recording_submitted': 'Recording Submitted' }[data.journey_state] || data.journey_state;

  function formatDate(isoString: string): string {
    return new Date(isoString).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  return (
    <div className="rounded-xl border border-[var(--color-neutral-200)] bg-white p-5 hover:shadow-md transition-shadow">
      <div className="flex flex-col gap-4">
        {/* Package name + badge */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="flex-1 font-semibold text-[var(--text-primary)] text-base leading-tight">
            {data.package_name}
          </h3>
          <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap border ${statusInfo.bg} ${statusInfo.text} border-current border-opacity-20`}>
            {statusLabel}
          </span>
        </div>

        {/* Last assessment date + expires */}
        <div className="text-xs text-[var(--color-neutral-500)] space-y-1">
          {data.last_assessment_date && (
            <div>
              {isAr ? 'آخر تقييم: ' : 'Last assessment: '}
              <span className="text-[var(--color-neutral-700)]">{formatDate(data.last_assessment_date)}</span>
            </div>
          )}
          <div>
            {isAr ? 'تنتهي في: ' : 'Expires: '}
            <span className="text-[var(--color-neutral-700)]">{formatDate(data.expires_at)}</span>
          </div>
        </div>

        {/* CTA button */}
        <a
          href={`/${locale}/portal/packages/${data.instance_id}/assessment`}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-primary-dark)] transition-colors min-h-[44px] mt-1"
        >
          {isAr ? 'عرض التفاصيل' : 'View Details'}
        </a>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function StudentPackagesPage() {
  const { locale } = useParams<{ locale: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const isAr = locale === 'ar';

  const [packages, setPackages] = useState<PackageCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    fetch(`/api/packages`)
      .then((r) => {
        if (!r.ok) {
          return r.json().then((d: { error?: string }) => {
            throw new Error(d.error ?? 'Failed to load packages');
          });
        }
        return r.json() as Promise<{ packages: PackageCardData[] }>;
      })
      .then((d) => {
        setPackages(d.packages || []);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [user]);

  // ── Loading states ──────────────────────────────────────────────────────────

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
            {isAr ? 'يرجى تسجيل الدخول' : 'Please sign in to view your packages.'}
          </p>
          <a
            href={`/${locale}/auth/login?redirect=/${locale}/portal/packages`}
            className="mt-3 inline-block text-[var(--color-primary)] font-medium hover:underline"
          >
            {isAr ? 'تسجيل الدخول' : 'Sign in'}
          </a>
        </div>
      </Section>
    );
  }

  if (loading) {
    return (
      <Section variant="white">
        <div className="mx-auto max-w-2xl space-y-4 animate-pulse">
          <div className="h-8 w-1/3 rounded-lg bg-[var(--color-neutral-100)]" />
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 rounded-xl bg-[var(--color-neutral-100)]" />
            ))}
          </div>
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
        <div className="mx-auto max-w-4xl">
          <Heading level={1}>
            {isAr ? 'برامجك' : 'Your Packages'}
          </Heading>

          {packages.length === 0 ? (
            <div className="mt-8 rounded-xl border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-8 text-center">
              <p className="text-[var(--color-neutral-600)]">
                {isAr
                  ? 'لا توجد برامج حالياً. تواصل مع مرشدك للبدء.'
                  : 'No packages yet. Contact your mentor to get started.'}
              </p>
            </div>
          ) : (
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {packages.map((pkg) => (
                <PackageCard
                  key={pkg.instance_id}
                  data={pkg}
                  isAr={isAr}
                  locale={locale}
                />
              ))}
            </div>
          )}

          {/* Back to portal */}
          <div className="mt-8 pt-4">
            <button
              onClick={() => router.push(`/${locale}/portal`)}
              className="text-sm text-[var(--color-neutral-500)] hover:text-[var(--text-primary)] transition-colors"
            >
              {isAr ? '← العودة إلى لوحة التحكم' : '← Back to Dashboard'}
            </button>
          </div>
        </div>
      </Section>
    </main>
  );
}
