/**
 * /[locale]/scholarships — Kun Scholarship Fund transparency dashboard.
 *
 * Wave E.4 (2026-04-26).
 *
 * Architecture:
 *   - Server component. Reads aggregate metrics directly from the data layer
 *     (lib/scholarship-transparency.ts) — no internal HTTP hop.
 *   - ISR with revalidate=300 (5-min) so the page itself is cacheable at the
 *     CDN tier alongside the in-process data cache.
 *   - Feature-flag gated (notFound() when SCHOLARSHIP_PUBLIC_LAUNCH !== 'true').
 *     Middleware also 404s the route ahead of this component; this is
 *     defense-in-depth for the same reason as /donate.
 *
 * Dignity-framing:
 *   - Hero copy is methodology-clean. No banned words.
 *   - Selection criteria summarized in one sentence; no scoring detail.
 *   - No recipient names anywhere — enforced at data-layer level
 *     (SMALL_N suppression) and reaffirmed in the component.
 *
 * IP boundary: NO mention of program session counts, beat sequences, or
 * exercise prompts. Only philosophy + impressions per CLAUDE.md.
 */

import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Section, Heading } from '@kunacademy/ui';
import { isScholarshipPublicLaunched } from '@/lib/feature-flags';
import { getTransparencyData } from '@/lib/scholarship-transparency';
import { ScholarshipsBoard } from '@/components/ScholarshipsBoard';

interface ScholarshipsPageProps {
  params: Promise<{ locale: string }>;
}

// ISR — 5-minute revalidate window aligns with the in-process data cache.
// We deliberately use revalidate (not force-dynamic) here because:
//   - the underlying data is read-only and bounded (small response shape),
//   - the CDN can cache the rendered HTML for 5 min cheaply,
//   - if the flag flips, the next revalidation will respect it (we still
//     re-check the flag inside the component on every render).
//
// Note: the /donate page uses force-dynamic because the donation form has
// per-session Stripe interactions; the transparency dashboard does not.
export const revalidate = 300;

export async function generateMetadata({ params }: ScholarshipsPageProps) {
  const { locale } = await params;
  if (!isScholarshipPublicLaunched()) {
    return { title: 'Not Found' };
  }
  const isAr = locale === 'ar';
  return {
    title: isAr
      ? 'صندوق منح كُن — السجل الشفاف'
      : 'Kun Scholarship Fund — Transparency Ledger',
    description: isAr
      ? 'الأرقام الحالية لصندوق منح كُن: ما تم جمعه، ما تم صرفه، البرامج التي يغطّيها الصندوق، والمستفيدون.'
      : 'Current figures for the Kun Scholarship Fund: amounts raised, amounts disbursed, programs covered, and beneficiaries.',
    robots: { index: false, follow: false },
  };
}

export default async function ScholarshipsPage({ params }: ScholarshipsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Feature-flag gate — defense-in-depth.
  if (!isScholarshipPublicLaunched()) {
    notFound();
  }

  if (locale !== 'ar' && locale !== 'en') {
    notFound();
  }

  // Fetch aggregates — never throws to the caller for empty data; the data
  // layer returns an empty-state shape when the DB is empty. Catch only
  // genuine errors and degrade gracefully.
  let data;
  try {
    data = await getTransparencyData();
  } catch (err) {
    console.error('[scholarships-page] failed to load transparency data:', err);
    // Render a minimal fallback so the page never blank-screens. This is
    // also the four-role attacker check: "force-render with broken DB".
    data = null;
  }

  const isAr = locale === 'ar';

  return (
    <main>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <Section variant="white" className="py-12 md:py-16">
        <div className="mx-auto max-w-3xl">
          <header>
            <Heading level={1} className="text-3xl md:text-4xl font-bold mb-6">
              {isAr
                ? 'صندوق منح كُن — السجل الشفاف'
                : 'The Kun Scholarship Fund — Transparency Ledger'}
            </Heading>
            <p className="text-base md:text-lg leading-relaxed text-[var(--color-neutral-700)]">
              {isAr
                ? 'كل مساهمة تُسجَّل، وكل قرار تخصيص يُوثَّق. هذه الصفحة تعرض الأرقام كما هي — دون تفاصيل تكشف هويّة المتقدّمين، ودون اقتطاع من المساهمات لصالح الإدارة أو التسويق.'
                : 'Every contribution is recorded, and every allocation decision is logged. This page surfaces the figures exactly as they stand — without details that would identify applicants, and without any portion deducted for administration or marketing.'}
            </p>
          </header>
        </div>
      </Section>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <Section variant="surface" className="py-12 md:py-16">
        <div className="mx-auto max-w-4xl">
          {data ? (
            <ScholarshipsBoard locale={locale as 'ar' | 'en'} data={data} />
          ) : (
            <div className="rounded-lg border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-6 md:p-8 text-center">
              <p className="text-base text-[var(--color-neutral-700)]">
                {isAr
                  ? 'الأرقام غير متاحة الآن. يرجى المحاولة بعد قليل.'
                  : 'Figures are unavailable right now. Please try again shortly.'}
              </p>
            </div>
          )}
        </div>
      </Section>
    </main>
  );
}
