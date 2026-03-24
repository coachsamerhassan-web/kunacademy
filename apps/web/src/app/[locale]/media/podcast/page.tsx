import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

export default async function PodcastPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section>
        <Heading level={1}>{isAr ? 'البودكاست' : 'Podcast'}</Heading>
        <p className="mt-4 text-[var(--color-neutral-700)]">
          {isAr
            ? 'حوارات معمّقة حول الكوتشنغ والتفكير الحسّي والنمو المهني.'
            : 'In-depth conversations on coaching, Somatic Thinking®, and professional growth.'}
        </p>
      </Section>

      <Section>
        <div className="space-y-6">
          {/* Podcast episodes will be populated from RSS/CMS */}
          <div className="rounded-lg border border-[var(--color-neutral-200)] p-6">
            <p className="text-sm text-[var(--color-neutral-500)]">
              {isAr ? 'الحلقات قيد الإعداد' : 'Episodes coming soon'}
            </p>
          </div>
        </div>
      </Section>
    </main>
  );
}
