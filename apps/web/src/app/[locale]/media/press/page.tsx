import { setRequestLocale } from 'next-intl/server';
import { PageHero } from '@/components/page-hero';

import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

export default async function PressPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <PageHero
        locale={locale}
        titleAr="التغطية الإعلامية"
        titleEn="Press Coverage"
        subtitleAr="كُن في الإعلام"
        subtitleEn="Kun in the media"
        eyebrowAr="الوسائط"
        eyebrowEn="Media"
        pattern="flower-of-life"
      />

      <Section>
        <div className="space-y-6">
          {/* Press items will be populated from CMS */}
          <div className="rounded-lg border border-[var(--color-neutral-200)] p-6">
            <p className="text-sm text-[var(--color-neutral-500)]">
              {isAr ? 'التغطيات الإعلامية قيد الإعداد' : 'Press coverage coming soon'}
            </p>
          </div>
        </div>
      </Section>
    </main>
  );
}
