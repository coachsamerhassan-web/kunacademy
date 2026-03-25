import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { OrdersDashboard } from './orders-dashboard';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main>
      <Section variant="white">
        <Heading level={1} className="mb-8">
          {locale === 'ar' ? 'طلباتي وتحميلاتي' : 'My Orders & Downloads'}
        </Heading>
        <OrdersDashboard locale={locale} />
      </Section>
    </main>
  );
}
