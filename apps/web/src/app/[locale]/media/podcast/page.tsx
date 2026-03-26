import { setRequestLocale } from 'next-intl/server';
import { PageHero } from '@/components/page-hero';
import { Section } from '@kunacademy/ui/section';
import type { Metadata } from 'next';

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'البودكاست | أكاديمية كُن' : 'Podcast | Kun Academy',
    description: isAr
      ? 'بودكاست كُن — محادثات في التفكير الحسّي والكوتشينج والحضور والقيادة'
      : 'Kun Podcast — conversations on Somatic Thinking, coaching, presence, and leadership',
  };
}

export default async function PodcastPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <PageHero
        locale={locale}
        titleAr="البودكاست"
        titleEn="Podcast"
        subtitleAr="محادثات في التفكير الحسّي والكوتشينج والحضور والقيادة"
        subtitleEn="Conversations on Somatic Thinking, coaching, presence, and leadership"
        eyebrowAr="الوسائط"
        eyebrowEn="Media"
        pattern="flower-of-life"
      />

      <Section variant="white">
        <div className="max-w-2xl mx-auto text-center">
          <div className="h-16 w-16 rounded-2xl bg-[var(--color-primary-50)] flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
              <path d="M19 10v2a7 7 0 01-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </div>
          <h2
            className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-4"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'البودكاست قادم قريبًا' : 'Podcast Coming Soon'}
          </h2>
          <p
            className="text-[var(--color-neutral-600)] leading-relaxed max-w-xl mx-auto mb-8"
            style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
          >
            {isAr
              ? 'نعمل على إعداد بودكاست يحمل روح التفكير الحسّي® — محادثات حقيقية مع كوتشز ومتخصصين وقادة حول العلاقة بين الجسد والوعي والقيادة.'
              : 'We\'re preparing a podcast that carries the spirit of Somatic Thinking® — real conversations with coaches, specialists, and leaders about the relationship between body, awareness, and leadership.'}
          </p>
          <p className="text-sm text-[var(--color-neutral-500)]">
            {isAr
              ? 'في هذه الأثناء، تابعنا على يوتيوب وإنستجرام للمحتوى الجديد'
              : 'Meanwhile, follow us on YouTube and Instagram for new content'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 mt-6">
            <a
              href="https://www.youtube.com/@KunCoaching"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white min-h-[44px] hover:bg-red-700 transition-all duration-300"
            >
              YouTube
            </a>
            <a
              href="https://www.instagram.com/kuncoaching/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 px-5 py-2.5 text-sm font-semibold text-white min-h-[44px] hover:opacity-90 transition-all duration-300"
            >
              Instagram
            </a>
          </div>
        </div>
      </Section>
    </main>
  );
}
