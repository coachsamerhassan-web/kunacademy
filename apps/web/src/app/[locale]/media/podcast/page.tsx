import { setRequestLocale } from 'next-intl/server';
import { PageHero } from '@/components/page-hero';

import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

export default async function PodcastPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <PageHero
        locale={locale}
        titleAr="البودكاست"
        titleEn="Podcast"
        subtitleAr="محادثات في التفكير الحسّي والكوتشينج"
        subtitleEn="Conversations on Somatic Thinking and coaching"
        eyebrowAr="الوسائط"
        eyebrowEn="Media"
        pattern="flower-of-life"
      />

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
