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
    title: isAr ? 'التغطية الإعلامية | أكاديمية كُن' : 'Press Coverage | Kun Academy',
    description: isAr
      ? 'كُن في الإعلام — تغطيات ومقابلات ومشاركات سامر حسن وأكاديمية كُن'
      : 'Kun in the media — coverage, interviews, and appearances by Samer Hassan and Kun Academy',
  };
}

const highlights = [
  {
    titleAr: 'جائزة القائد الشاب — ICF 2019',
    titleEn: 'ICF Young Leader Award 2019',
    descAr: 'حصل سامر حسن على جائزة القائد الشاب من الاتحاد الدولي للكوتشينج (ICF) تقديرًا لمساهماته في نشر ثقافة الكوتشينج في المنطقة العربية.',
    descEn: 'Samer Hassan received the Young Leader Award from the International Coaching Federation (ICF) in recognition of his contributions to spreading coaching culture in the Arab region.',
    yearAr: '٢٠١٩',
    yearEn: '2019',
  },
  {
    titleAr: 'أول عربي MCC',
    titleEn: 'First Arab MCC',
    descAr: 'سامر حسن أول متحدّث بالعربية يحصل على أعلى شهادة في الكوتشينج المهني — Master Certified Coach من ICF.',
    descEn: 'Samer Hassan became the first Arabic speaker to earn the highest professional coaching credential — Master Certified Coach from ICF.',
    yearAr: '٢٠١٧',
    yearEn: '2017',
  },
  {
    titleAr: '٥٠٠+ كوتش خريج',
    titleEn: '500+ Coach Graduates',
    descAr: 'أكثر من ٥٠٠ كوتش تخرّجوا من برنامج STCE في أكاديمية كُن من ٤ قارات.',
    descEn: 'Over 500 coaches have graduated from the STCE program at Kun Academy across 4 continents.',
    yearAr: '٢٠٢٤',
    yearEn: '2024',
  },
];

export default async function PressPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <PageHero
        locale={locale}
        titleAr="التغطية الإعلامية"
        titleEn="Press Coverage"
        subtitleAr="كُن في الإعلام — محطات بارزة ومشاركات دولية"
        subtitleEn="Kun in the media — notable milestones and international appearances"
        eyebrowAr="الوسائط"
        eyebrowEn="Media"
        pattern="flower-of-life"
      />

      {/* Highlights */}
      <Section variant="white">
        <div className="text-center mb-10">
          <h2
            className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'محطات بارزة' : 'Key Highlights'}
          </h2>
        </div>
        <div className="max-w-3xl mx-auto space-y-6">
          {highlights.map((item, i) => (
            <Card key={i} accent className="p-6">
              <div className="flex items-start gap-5">
                <div className="shrink-0 h-14 w-14 rounded-2xl bg-[var(--color-primary-50)] flex items-center justify-center">
                  <span className="text-sm font-bold text-[var(--color-primary)]">
                    {isAr ? item.yearAr : item.yearEn}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-[var(--text-primary)] mb-1">
                    {isAr ? item.titleAr : item.titleEn}
                  </h3>
                  <p className="text-sm text-[var(--color-neutral-600)] leading-relaxed">
                    {isAr ? item.descAr : item.descEn}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      {/* Contact */}
      <Section variant="surface">
        <div className="text-center py-4">
          <h2
            className="text-xl md:text-2xl font-bold text-[var(--text-primary)] mb-3"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'للاستفسارات الإعلامية' : 'Media Inquiries'}
          </h2>
          <p className="text-[var(--color-neutral-600)] mb-6 max-w-xl mx-auto">
            {isAr
              ? 'للتواصل مع الفريق الإعلامي لأكاديمية كُن أو لطلب مقابلة مع سامر حسن'
              : 'To reach Kun Academy\'s media team or request an interview with Samer Hassan'}
          </p>
          <a
            href="mailto:info@kuncoaching.com"
            className="inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] px-8 py-3.5 text-base font-semibold text-white min-h-[52px] hover:bg-[var(--color-primary-600)] transition-all duration-300"
          >
            info@kuncoaching.com
          </a>
        </div>
      </Section>
    </main>
  );
}
