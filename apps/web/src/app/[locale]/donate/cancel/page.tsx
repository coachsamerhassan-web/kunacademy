/**
 * /[locale]/donate/cancel — Stripe Checkout cancel landing page.
 *
 * Wave E.3 (2026-04-25).
 *
 * User aborted Stripe Checkout (clicked "Back" or closed the tab). No
 * charge was made. We show a soft acknowledgement and a link back to
 * /donate so they can retry if they wish.
 */

import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Section, Heading } from '@kunacademy/ui';
import { isScholarshipPublicLaunched } from '@/lib/feature-flags';

interface CancelPageProps {
  params: Promise<{ locale: string }>;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export function generateMetadata() {
  return {
    title: 'No contribution processed',
    robots: { index: false, follow: false },
  };
}

export default async function DonateCancelPage({ params }: CancelPageProps) {
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
            {isAr ? 'لم تُسجَّل أيّ مساهمة' : 'No contribution was made'}
          </Heading>

          <p className="text-base md:text-lg leading-relaxed text-[var(--color-neutral-700)] mb-8">
            {isAr
              ? 'عدتَ قبل إتمام الدفع — لم يُخصَم أيّ مبلغ. إن كنتَ مستعدًّا، يمكنك المحاولة من جديد في أيّ وقت.'
              : 'You stepped away before completing payment — no amount was charged. Whenever you\u2019re ready, you can try again.'}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={`/${locale}/donate`}
              className="inline-flex items-center justify-center min-h-[44px] rounded-lg bg-[var(--color-primary)] text-white px-5 py-3 text-sm font-medium hover:opacity-90 transition"
            >
              {isAr ? 'العودة إلى المساهمة' : 'Return to donation form'}
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
