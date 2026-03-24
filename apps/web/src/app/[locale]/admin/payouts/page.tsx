import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="white">
        <Heading level={1} className="mb-8">
          {isAr ? 'المستحقات' : 'Payouts'}
        </Heading>
        <div className="bg-[var(--color-surface-container)] rounded-2xl p-8 min-h-[400px]">
          <p className="text-[var(--color-neutral-500)] text-center">
            {isAr ? 'لوحة الإدارة — قيد البناء' : 'Admin panel — under construction'}
          </p>
        </div>
      </Section>
    </main>
  );
}
