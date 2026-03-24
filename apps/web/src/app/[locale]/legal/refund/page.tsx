import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="surface" hero>
        <div className="max-w-3xl mx-auto text-center">
          <Heading level={1}>
            {isAr ? 'سياسة الاسترجاع' : 'Refund Policy'}
          </Heading>
          <p className="mt-4 text-sm text-[var(--color-neutral-500)]">
            {isAr ? 'آخر تحديث: مارس 2026' : 'Last updated: March 2026'}
          </p>
        </div>
      </Section>

      <Section variant="white">
        <div className="prose prose-lg max-w-3xl mx-auto">
          <p className="text-[var(--color-neutral-600)]">
            {isAr ? 'المحتوى القانوني قيد النقل من الموقع القديم' : 'Legal content being migrated from the old site'}
          </p>
        </div>
      </Section>
    </main>
  );
}
