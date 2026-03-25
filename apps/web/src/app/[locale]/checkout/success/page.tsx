import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { SuccessContent } from './success-content';

export default async function CheckoutSuccessPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="white" className="min-h-[60vh] flex items-center">
        <div className="mx-auto max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <Heading level={1}>{isAr ? 'تم الدفع بنجاح!' : 'Payment Successful!'}</Heading>
          <p className="mt-2 text-[var(--color-neutral-600)]">
            {isAr ? 'شكرًا لك. تم تفعيل اشتراكك.' : 'Thank you. Your enrollment has been activated.'}
          </p>
          <Suspense>
            <SuccessContent locale={locale} />
          </Suspense>
        </div>
      </Section>
    </main>
  );
}
