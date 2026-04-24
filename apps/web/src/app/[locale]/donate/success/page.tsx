/**
 * /[locale]/donate/success — Stripe Checkout success landing page.
 *
 * Wave E.3 (2026-04-25).
 *
 * Lifecycle:
 *   1. Donor completes Stripe Checkout.
 *   2. Stripe redirects to this page with ?session_id=cs_xxx.
 *   3. We show a dignity-framed thank-you. We do NOT look up the Stripe
 *      session server-side because anyone with a session_id (leaked via
 *      browser history, referer header, shared screenshot, etc.) could
 *      then enumerate donor name + amount + designation. The webhook is
 *      the authoritative source of truth for the donation row — this
 *      page is purely visual acknowledgement.
 *   4. The donor's own receipt comes from Stripe's own email (receipt_email
 *      set on the PaymentIntent in stripe-donations.ts).
 *
 * Security posture:
 *   - No server-side lookup of session_id — prevents PII enumeration.
 *   - session_id is ignored entirely; only presence of the query param
 *     tells us the user went through Stripe flow (no UX change either way).
 *   - The webhook handler (E.2 donation-webhook-handlers.ts) is the only
 *     writer of the donations row.
 */

import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Section, Heading } from '@kunacademy/ui';
import { isScholarshipPublicLaunched } from '@/lib/feature-flags';

interface SuccessPageProps {
  params: Promise<{ locale: string }>;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export function generateMetadata() {
  return {
    title: 'Thank you',
    robots: { index: false, follow: false },
  };
}

export default async function DonateSuccessPage({ params }: SuccessPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  if (!isScholarshipPublicLaunched()) {
    notFound();
  }

  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="white" className="min-h-[60vh] py-12 md:py-16">
        <div className="mx-auto max-w-xl text-center">
          <Heading level={1} className="text-2xl md:text-3xl font-bold mb-6">
            {isAr ? 'شكرًا على مساهمتك' : 'Thank you for your contribution'}
          </Heading>

          <p className="text-base md:text-lg leading-relaxed text-[var(--color-neutral-700)] mb-6">
            {isAr
              ? 'وصلت مساهمتك. متقدِّم واحد سيَعبُر الباب قريبًا لأنّك فتحته.'
              : 'Your contribution has landed. One applicant will walk through the door soon because you opened it.'}
          </p>

          <p className="text-sm text-[var(--color-neutral-600)] mb-2">
            {isAr
              ? 'يصلك إيصال الدفع عبر البريد الإلكتروني من Stripe خلال دقائق.'
              : 'A payment receipt will arrive in your inbox from Stripe within a few minutes.'}
          </p>

          <p className="text-sm text-[var(--color-neutral-600)] mb-8">
            {isAr
              ? 'سنُرسل إليك إشعارًا عند تخصيص مساهمتك لمتقدِّم بعينه. قد يستغرق ذلك بعض الوقت — القائمة تُراجع في دُفعات.'
              : 'You will receive a note when your contribution is allocated to a specific applicant. This may take some time — the queue is reviewed in cohorts.'}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={`/${locale}/scholarships`}
              className="inline-flex items-center justify-center min-h-[44px] rounded-lg border border-[var(--color-primary)] px-5 py-3 text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition"
            >
              {isAr ? 'كيف تُخصَّص المساهمات' : 'How contributions are allocated'}
            </a>
            <a
              href={`/${locale}`}
              className="inline-flex items-center justify-center min-h-[44px] rounded-lg px-5 py-3 text-sm font-medium text-[var(--color-neutral-600)] hover:text-[var(--color-primary)] transition"
            >
              {isAr ? 'العودة إلى كُن' : 'Back to Kun'}
            </a>
          </div>
        </div>
      </Section>
    </main>
  );
}
