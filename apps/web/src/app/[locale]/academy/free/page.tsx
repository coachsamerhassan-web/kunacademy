import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Card } from '@kunacademy/ui/card';
import type { Metadata } from 'next';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'موارد مجانية | أكاديمية كُن' : 'Free Resources | Kun Academy',
    description: isAr
      ? 'موارد مجانية لبدء رحلتك مع التفكير الحسّي® — مقالات وفيديوهات وأدوات'
      : 'Free resources to start your journey with Somatic Thinking® — articles, videos, and tools',
  };
}

const resources = [
  {
    titleAr: 'المدوّنة',
    titleEn: 'Blog',
    descAr: 'مقالات في التفكير الحسّي والكوتشينج والنمو المهني — بقلم سامر حسن وفريق كُن',
    descEn: 'Articles on Somatic Thinking, coaching, and professional growth — by Samer Hassan and the Kun team',
    href: 'blog',
    iconPath: 'M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z',
  },
  {
    titleAr: 'أداة المسار',
    titleEn: 'Pathfinder',
    descAr: 'اكتشف البرنامج الأنسب لك من خلال أسئلة بسيطة — مجاني ١٠٠٪',
    descEn: 'Discover the right program for you through simple questions — 100% free',
    href: 'pathfinder',
    iconPath: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7',
  },
  {
    titleAr: 'الدورة التمهيدية (STI)',
    titleEn: 'Introductory Course (STI)',
    descAr: '٦ ساعات مسجّلة — بوابتك الأولى لعالم التفكير الحسّي بسعر رمزي',
    descEn: '6 recorded hours — your first gateway to Somatic Thinking at an accessible price',
    href: 'academy/intro',
    iconPath: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
];

export default async function FreeResourcesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden py-12 md:py-20 bg-[var(--color-background)]">
        <GeometricPattern pattern="flower-of-life" opacity={0.3} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6">
          <a href={`/${locale}/academy`} className="text-sm text-[var(--color-primary)] hover:underline mb-4 inline-block">
            <ArrowLeft className="w-4 h-4 inline-block rtl:rotate-180" aria-hidden="true" /> {isAr ? 'الأكاديمية' : 'Academy'}
          </a>
          <h1
            className="text-[2.25rem] md:text-[3.5rem] font-bold text-[var(--text-primary)] leading-tight"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'موارد مجانية' : 'Free Resources'}
          </h1>
          <p className="mt-4 text-[var(--text-muted)] text-lg">
            {isAr
              ? 'ابدأ رحلتك مع التفكير الحسّي® بدون أي تكلفة'
              : 'Start your journey with Somatic Thinking® at no cost'}
          </p>
        </div>
      </section>

      {/* Resources */}
      <Section variant="white">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {resources.map((resource) => (
            <a key={resource.href} href={`/${locale}/${resource.href}`} className="group">
              <Card accent className="p-6 h-full transition-all duration-300 group-hover:shadow-[0_12px_40px_rgba(71,64,153,0.12)] group-hover:-translate-y-1">
                <div className="h-12 w-12 rounded-xl bg-[var(--color-primary-50)] flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d={resource.iconPath} />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] transition-colors mb-2">
                  {isAr ? resource.titleAr : resource.titleEn}
                </h3>
                <p className="text-sm text-[var(--color-neutral-600)] leading-relaxed">
                  {isAr ? resource.descAr : resource.descEn}
                </p>
                <span className="inline-flex items-center mt-4 text-sm font-semibold text-[var(--color-accent)]">
                  {isAr ? 'استكشف' : 'Explore'} <ArrowRight className="w-4 h-4 inline-block rtl:rotate-180" aria-hidden="true" />
                </span>
              </Card>
            </a>
          ))}
        </div>
      </Section>
    </main>
  );
}
