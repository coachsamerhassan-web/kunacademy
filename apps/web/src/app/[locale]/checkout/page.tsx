import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { CheckoutFlow } from './checkout-flow';

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="white" className="min-h-[60vh]">
        <div className="mx-auto max-w-lg">
          <Heading level={1}>{isAr ? 'إتمام الدفع' : 'Checkout'}</Heading>
          <Suspense fallback={<div className="py-8 text-center">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>}>
            <CheckoutFlow locale={locale} />
          </Suspense>
        </div>
      </Section>
    </main>
  );
}
