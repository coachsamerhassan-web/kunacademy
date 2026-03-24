import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

export default async function ProductDetailPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section>
        <div className="grid gap-12 md:grid-cols-2">
          <div className="aspect-square rounded-lg bg-[var(--color-neutral-100)]" />
          <div>
            <Heading level={1}>{slug}</Heading>
            <p className="mt-4 text-[var(--color-neutral-700)]">
              {isAr
                ? 'تفاصيل المنتج ستُحمّل من نظام التجارة.'
                : 'Product details will be loaded from the commerce system.'}
            </p>
          </div>
        </div>
      </Section>
    </main>
  );
}
