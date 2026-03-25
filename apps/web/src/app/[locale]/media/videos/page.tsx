import { setRequestLocale } from 'next-intl/server';
import { PageHero } from '@/components/page-hero';

import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

export default async function VideosPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <PageHero
        locale={locale}
        titleAr="مكتبة الفيديو"
        titleEn="Video Library"
        subtitleAr="محتوى مرئي من أكاديمية كُن"
        subtitleEn="Video content from Kun Academy"
        eyebrowAr="الوسائط"
        eyebrowEn="Media"
        pattern="flower-of-life"
      />

      <Section>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* Video cards will be populated from CMS/YouTube API */}
          <div className="aspect-video rounded-lg bg-[var(--color-neutral-100)] flex items-center justify-center">
            <p className="text-[var(--color-neutral-500)]">
              {isAr ? 'قريبًا' : 'Coming soon'}
            </p>
          </div>
        </div>
      </Section>
    </main>
  );
}
