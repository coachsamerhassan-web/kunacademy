import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { ProductsManager } from './products-manager';

export default async function CoachProductsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="white">
        <div className="mx-auto max-w-4xl">
          <Heading level={1}>{isAr ? 'إدارة الخدمات' : 'Service Management'}</Heading>
          <p className="mt-2 text-[var(--color-neutral-600)]">
            {isAr ? 'أنشئ وأدِر الخدمات التي تظهر في نظام الحجز' : 'Create and manage services that appear in the booking system'}
          </p>
          <ProductsManager locale={locale} />
        </div>
      </Section>
    </main>
  );
}
