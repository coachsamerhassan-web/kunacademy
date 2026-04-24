/**
 * /[locale]/donate — Kun Scholarship Fund donation page.
 *
 * Wave E.3 (2026-04-25).
 *
 * Architecture:
 *   - Server component: sets locale, feature-flag guards (404s when off),
 *     renders the locked dignity-framed hero + reciprocity context.
 *   - Client component (donation-form.tsx): amount picker, custom amount,
 *     donor fields, POST → /api/donations/create-intent → redirect to
 *     Stripe Checkout.
 *
 * Dignity-framing: the hero copy below is VERBATIM from spec §3.1 and LOCKED.
 * Do not paraphrase without Samer signoff. The dignity-framing lint
 * (apps/web/scripts/lint-dignity-framing.ts) scans this file for banned
 * words; keep copy free of: free, charity, entry-level, discount, poor,
 * needy, option of last resort (EN) + مجاني, صدقة, خيري, فقير, محتاج,
 * معوز, خصم (AR).
 */

import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui';
import { Heading } from '@kunacademy/ui';
import { DonationForm } from './donation-form';
import { isScholarshipPublicLaunched } from '@/lib/feature-flags';

interface DonatePageProps {
  params: Promise<{ locale: string }>;
}

export const dynamic = 'force-dynamic'; // never cache — flag can flip
export const revalidate = 0;

export async function generateMetadata({ params }: DonatePageProps) {
  const { locale } = await params;
  // When flag off, generate empty metadata (page 404s anyway)
  if (!isScholarshipPublicLaunched()) {
    return { title: 'Not Found' };
  }
  const isAr = locale === 'ar';
  return {
    title: isAr
      ? 'صندوق منح كُن — ادعم مقعد آخر'
      : 'Kun Scholarship Fund — Support Another Seat',
    // No description on purpose — page is flag-gated at launch; SEO comes
    // online at CT-advisory clearance.
    robots: { index: false, follow: false },
  };
}

export default async function DonatePage({ params }: DonatePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Feature-flag gate — defense-in-depth with middleware.
  // Middleware 404s the request before it ever reaches this component, but
  // we re-check here so the page never renders partial content if the
  // middleware is bypassed (e.g. via direct server-component import in a
  // future refactor).
  if (!isScholarshipPublicLaunched()) {
    notFound();
  }

  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="white" className="min-h-[60vh] py-12 md:py-16">
        <div className="mx-auto max-w-2xl">
          {/* Locked dignity-framed hero — spec §3.1 verbatim */}
          <header className="mb-10 md:mb-12">
            <Heading level={1} className="text-3xl md:text-4xl font-bold mb-6">
              {isAr
                ? 'صندوق منح كُن — حين تجد رحلتك، تفتح الطريق لآخر.'
                : "The Kun Scholarship Fund — when you've found your path, you open the way for another."}
            </Heading>
            <p className="text-base md:text-lg leading-relaxed text-[var(--color-neutral-700)]">
              {isAr
                ? 'صندوق المنح يدعم مقاعد في برامج GPS وإحياء ووِصال وبذور لأشخاص اجتازوا استبيان الجاهزية ويستحقون الفرصة. مساهمتك تُخصَّص لمتقدّم حقيقي — لا للإدارة، لا للتسويق، لا للرسوم.'
                : 'The fund supports seats in GPS, Ihya, Wisal, and Seeds programs for applicants who have passed a readiness screening and merit the opportunity. Your contribution goes to a real applicant — not to overhead, not to marketing, not to fees.'}
            </p>
          </header>

          {/* Transparency link — even without E.4 being live, we surface
               the future transparency board so donors know it exists. When
               E.4 ships the link will resolve; until then it 404s per flag. */}
          <aside className="mb-10 rounded-lg border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-4 text-sm">
            <p className="text-[var(--color-neutral-700)]">
              {isAr ? (
                <>
                  كل مساهمة تُسجَّل في سجل شفاف. اعرف المزيد عن{' '}
                  <a
                    href={`/${locale}/scholarships`}
                    className="text-[var(--color-primary)] font-medium underline"
                  >
                    كيف تُخصَّص المساهمات
                  </a>
                  .
                </>
              ) : (
                <>
                  Every contribution is recorded in a transparent ledger. Learn more about{' '}
                  <a
                    href={`/${locale}/scholarships`}
                    className="text-[var(--color-primary)] font-medium underline"
                  >
                    how contributions are allocated
                  </a>
                  .
                </>
              )}
            </p>
          </aside>

          {/* Donation form — client component */}
          <DonationForm locale={locale} />
        </div>
      </Section>
    </main>
  );
}
