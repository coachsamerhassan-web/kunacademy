import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section>
        <Heading level={1}>{isAr ? 'سلة المشتريات' : 'Cart'}</Heading>
        <p className="mt-4 text-[var(--color-neutral-700)]">
          {isAr ? 'سلّتك فارغة حاليًا.' : 'Your cart is currently empty.'}
        </p>
      </Section>
    </main>
  );
}
