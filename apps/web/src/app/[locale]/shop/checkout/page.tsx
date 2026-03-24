import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section>
        <Heading level={1}>{isAr ? 'إتمام الشراء' : 'Checkout'}</Heading>
        <p className="mt-4 text-[var(--color-neutral-700)]">
          {isAr
            ? 'نظام الدفع قيد الإعداد. يُرجى التواصل معنا مباشرة لإتمام عملية الشراء.'
            : 'Payment system is under development. Please contact us directly to complete your purchase.'}
        </p>
      </Section>
    </main>
  );
}
