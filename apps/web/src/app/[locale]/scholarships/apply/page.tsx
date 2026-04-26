/**
 * /[locale]/scholarships/apply — Kun Scholarship Fund public application form.
 *
 * Wave E.5 (2026-04-26).
 *
 * Architecture:
 *   - Server component: feature-flag gate (404 when off), pre-fetches
 *     eligible programs from canon (`programs.scholarship_eligible=true`),
 *     locks dignity-framed hero copy, hands off to client component
 *     `ScholarshipApplicationForm.tsx` for the interactive form.
 *
 * Dignity-framing:
 *   - Hero copy is methodology-clean. NO scoring detail revealed.
 *   - Selection criteria summarized as one phrase ("based on financial
 *     situation + readiness for the work").
 *   - Reciprocity field labeled per spec §3.3 ("what you will give").
 *   - Form prompts use spec §4.3 step 5 dignity-clean wording.
 *
 * IP boundary: NO program session counts, beat sequences, or exercise prompts.
 */

import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Section, Heading } from '@kunacademy/ui';
import { isScholarshipPublicLaunched } from '@/lib/feature-flags';
import { listEligibleScholarshipPrograms } from '@/lib/scholarship-application';
import { ScholarshipApplicationForm } from '@/components/ScholarshipApplicationForm';

interface ApplyPageProps {
  params: Promise<{ locale: string }>;
}

// The form interacts with /api/scholarships/apply via fetch — never cache.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({ params }: ApplyPageProps) {
  const { locale } = await params;
  if (!isScholarshipPublicLaunched()) {
    return { title: 'Not Found' };
  }
  const isAr = locale === 'ar';
  return {
    title: isAr
      ? 'صندوق منح كُن — التقدّم بطلب'
      : 'Kun Scholarship Fund — Apply',
    description: isAr
      ? 'قدّم طلبك للحصول على منحة في برامج كُن.'
      : 'Apply for a scholarship in Kun programs.',
    robots: { index: false, follow: false },
  };
}

export default async function ScholarshipsApplyPage({ params }: ApplyPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  if (!isScholarshipPublicLaunched()) {
    notFound();
  }
  if (locale !== 'ar' && locale !== 'en') {
    notFound();
  }

  // Pull canon programs with scholarship_eligible=true. If the lookup fails
  // we render a graceful "try again" state rather than blank-screening.
  let programs: Awaited<ReturnType<typeof listEligibleScholarshipPrograms>> = [];
  let lookupError = false;
  try {
    programs = await listEligibleScholarshipPrograms();
  } catch (err) {
    console.error('[scholarships-apply-page] canon lookup failed:', err);
    lookupError = true;
  }

  const isAr = locale === 'ar';

  return (
    <main>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <Section variant="white" className="py-12 md:py-16">
        <div className="mx-auto max-w-2xl">
          <header>
            <Heading level={1} className="text-3xl md:text-4xl font-bold mb-6">
              {isAr
                ? 'التقدّم لمنحة من صندوق كُن'
                : 'Apply for a Kun Scholarship'}
            </Heading>
            <p className="text-base md:text-lg leading-relaxed text-[var(--color-neutral-700)]">
              {isAr
                ? 'هذا النموذج لمن يرى في نفسه استعداداً للرحلة لكنّ الكلفة عائق. نراجع كل طلب فردياً مع مراعاة السياق المالي والاستعداد للعمل. لا نطلب وثائق ولا نُجري مقابلات — كلامك في هذا النموذج هو الأساس.'
                : 'This form is for those who see readiness in themselves but for whom the fee is a barrier. We review each application individually, considering both the financial situation you describe and your readiness for the work. We do not require documents or interviews — what you write here is the basis for our review.'}
            </p>
          </header>

          {/* Reciprocity expectations — what you give back. */}
          <aside className="mt-6 rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 p-4 text-sm">
            <p className="font-medium text-[var(--color-neutral-800)] mb-2">
              {isAr ? 'ما نتوقّعه إن نُحت المنحة:' : 'What we expect if granted:'}
            </p>
            <p className="text-[var(--color-neutral-700)] leading-relaxed">
              {isAr
                ? 'الحضور الكامل، التطبيق بين الجلسات، ومشاركة قصتك بعد التخرج لمساعدة من سيأتون بعدك. وإن تيسّرت ظروفك لاحقاً، المساهمة في الصندوق لمن يأتي بعدك.'
                : 'Full attendance, between-session practice, and sharing your story after graduation to help future applicants. And if your circumstances allow later — a contribution to the fund to support the next applicant.'}
            </p>
          </aside>
        </div>
      </Section>

      {/* ── Form ──────────────────────────────────────────────────────── */}
      <Section variant="surface" className="py-8 md:py-12">
        <div className="mx-auto max-w-2xl">
          {lookupError ? (
            <div className="rounded-lg border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-6 text-center">
              <p className="text-base text-[var(--color-neutral-700)]">
                {isAr
                  ? 'لم نتمكّن من تحميل قائمة البرامج. يرجى المحاولة لاحقًا.'
                  : 'We could not load the program list. Please try again shortly.'}
              </p>
            </div>
          ) : programs.length === 0 ? (
            <div className="rounded-lg border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-6 text-center">
              <p className="text-base text-[var(--color-neutral-700)]">
                {isAr
                  ? 'لا توجد برامج متاحة للمنح حالياً.'
                  : 'No programs are currently open for scholarship applications.'}
              </p>
            </div>
          ) : (
            <ScholarshipApplicationForm
              locale={locale as 'ar' | 'en'}
              programs={programs}
            />
          )}
        </div>
      </Section>
    </main>
  );
}
