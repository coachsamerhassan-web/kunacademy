import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

export default async function EventsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section>
        <Heading level={1}>{isAr ? 'الفعاليات' : 'Events'}</Heading>
        <p className="mt-4 text-[var(--color-neutral-700)]">
          {isAr
            ? 'ورش عمل، ندوات، ولقاءات مباشرة من أكاديمية كُن.'
            : 'Workshops, webinars, and live gatherings from Kun Academy.'}
        </p>
      </Section>

      <Section>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* Event cards will be populated from CMS/Zoho */}
          <div className="rounded-lg border border-[var(--color-neutral-200)] p-6">
            <p className="text-sm text-[var(--color-neutral-500)]">
              {isAr ? 'لا توجد فعاليات قادمة حاليًا' : 'No upcoming events at this time'}
            </p>
          </div>
        </div>
      </Section>
    </main>
  );
}
