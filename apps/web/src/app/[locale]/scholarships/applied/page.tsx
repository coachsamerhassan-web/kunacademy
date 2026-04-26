/**
 * /[locale]/scholarships/applied — Wave E.5 thank-you page.
 *
 * Static success page that the form CAN navigate to as an alternative to the
 * inline success state. Currently the form renders inline success in-place,
 * but this page exists so an admin or external partner can link to it
 * (e.g., from a printable card given out at events).
 *
 * Server component, feature-flag gated, no PII, no methodology.
 */

import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Section, Heading } from '@kunacademy/ui';
import { isScholarshipPublicLaunched } from '@/lib/feature-flags';

interface AppliedPageProps {
  params: Promise<{ locale: string }>;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({ params }: AppliedPageProps) {
  const { locale } = await params;
  if (!isScholarshipPublicLaunched()) {
    return { title: 'Not Found' };
  }
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'استلمنا طلبك — صندوق منح كُن' : 'Application received — Kun Scholarship Fund',
    robots: { index: false, follow: false },
  };
}

export default async function ScholarshipsAppliedPage({ params }: AppliedPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  if (!isScholarshipPublicLaunched()) {
    notFound();
  }
  if (locale !== 'ar' && locale !== 'en') {
    notFound();
  }

  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="white" className="min-h-[60vh] py-16">
        <div className="mx-auto max-w-2xl text-center">
          <Heading level={1} className="text-3xl md:text-4xl font-bold mb-6">
            {isAr ? 'استلمنا طلبك' : 'We received your application'}
          </Heading>
          <p className="text-base md:text-lg text-[var(--color-neutral-700)] leading-relaxed mb-4">
            {isAr
              ? 'سنراجع طلبك خلال الأسابيع القادمة، وسنتواصل معك عبر البريد الإلكترونيّ.'
              : 'We will review your application in the coming weeks and reach out via email.'}
          </p>
          <p className="text-sm text-[var(--color-neutral-500)]">
            {isAr ? 'شكراً على ثقتك.' : 'Thank you for trusting us.'}
          </p>
        </div>
      </Section>
    </main>
  );
}
