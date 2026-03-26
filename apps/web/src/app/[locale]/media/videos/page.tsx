import { setRequestLocale } from 'next-intl/server';
import { PageHero } from '@/components/page-hero';
import { Section } from '@kunacademy/ui/section';
import { Card } from '@kunacademy/ui/card';
import type { Metadata } from 'next';

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'مكتبة الفيديو | أكاديمية كُن' : 'Video Library | Kun Academy',
    description: isAr
      ? 'محتوى مرئي من أكاديمية كُن — محاضرات ومقتطفات وجلسات حيّة في التفكير الحسّي'
      : 'Video content from Kun Academy — lectures, clips, and live sessions in Somatic Thinking',
  };
}

export default async function VideosPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <PageHero
        locale={locale}
        titleAr="مكتبة الفيديو"
        titleEn="Video Library"
        subtitleAr="محتوى مرئي من أكاديمية كُن — محاضرات ومقتطفات وجلسات حيّة"
        subtitleEn="Video content from Kun Academy — lectures, clips, and live sessions"
        eyebrowAr="الوسائط"
        eyebrowEn="Media"
        pattern="flower-of-life"
      />

      {/* YouTube Channel */}
      <Section variant="white">
        <div className="max-w-3xl mx-auto text-center">
          <div className="h-16 w-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          </div>
          <h2
            className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-3"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'قناة Kun Coaching على يوتيوب' : 'Kun Coaching on YouTube'}
          </h2>
          <p className="text-[var(--color-neutral-600)] mb-6 max-w-xl mx-auto">
            {isAr
              ? 'تابع قناتنا للحصول على مقتطفات من جلسات التفكير الحسّي ومحاضرات ونصائح عملية'
              : 'Follow our channel for Somatic Thinking session clips, lectures, and practical tips'}
          </p>
          <a
            href="https://www.youtube.com/@KunCoaching"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold text-white min-h-[48px] hover:bg-red-700 transition-all duration-300"
          >
            {isAr ? 'اشترك في القناة' : 'Subscribe to Channel'}
          </a>
        </div>
      </Section>

      {/* Content Categories */}
      <Section variant="surface">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <Card accent className="p-6 text-center">
            <h3 className="font-bold text-[var(--text-primary)] mb-2">
              {isAr ? 'مقتطفات الجلسات' : 'Session Clips'}
            </h3>
            <p className="text-sm text-[var(--color-neutral-600)]">
              {isAr
                ? 'لحظات مؤثرة من جلسات كوتشينج حقيقية — بإذن العملاء'
                : 'Powerful moments from real coaching sessions — with client permission'}
            </p>
          </Card>
          <Card accent className="p-6 text-center">
            <h3 className="font-bold text-[var(--text-primary)] mb-2">
              {isAr ? 'محاضرات ومداخلات' : 'Lectures & Talks'}
            </h3>
            <p className="text-sm text-[var(--color-neutral-600)]">
              {isAr
                ? 'من مؤتمرات ICF وفعاليات التطوير المهني حول العالم'
                : 'From ICF conferences and professional development events worldwide'}
            </p>
          </Card>
          <Card accent className="p-6 text-center">
            <h3 className="font-bold text-[var(--text-primary)] mb-2">
              {isAr ? 'تمارين عملية' : 'Practical Exercises'}
            </h3>
            <p className="text-sm text-[var(--color-neutral-600)]">
              {isAr
                ? 'تمارين حسّية يمكنك تجربتها الآن — من المنزل أو المكتب'
                : 'Somatic exercises you can try now — from home or office'}
            </p>
          </Card>
        </div>
      </Section>
    </main>
  );
}
