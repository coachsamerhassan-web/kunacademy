import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';

export default async function RetreatDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="default" className="min-h-[50vh] flex items-center">
        <div className="max-w-3xl mx-auto">
          <p className="text-[var(--color-accent)] font-medium mb-2">
            {isAr ? 'خلوة' : 'Retreat'}
          </p>
          <Heading level={1}>
            {isAr ? `خلوة: ${slug}` : `Retreat: ${slug}`}
          </Heading>
          <p className="mt-4 text-[var(--color-neutral-700)]">
            {isAr ? 'تفاصيل الخلوة ستُعرض هنا' : 'Retreat details will be displayed here'}
          </p>
        </div>
      </Section>

      <Section variant="white">
        <div className="max-w-3xl mx-auto">
          <Heading level={2}>
            {isAr ? 'عن هذه الخلوة' : 'About This Retreat'}
          </Heading>
          <p className="mt-4 text-[var(--color-neutral-600)]">
            {isAr ? 'تفاصيل البرنامج والموقع والتواريخ ستُعرض هنا' : 'Program details, location, and dates will be displayed here'}
          </p>
          <Button variant="primary" size="lg" className="mt-8">
            {isAr ? 'احجز مكانك' : 'Reserve Your Spot'}
          </Button>
        </div>
      </Section>
    </main>
  );
}
