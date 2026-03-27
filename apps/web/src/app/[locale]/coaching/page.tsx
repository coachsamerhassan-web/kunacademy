import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Card } from '@kunacademy/ui/card';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'الكوتشينج | أكاديمية كُن' : 'Coaching | Kun Academy',
    description: isAr
      ? 'جلسات كوتشينج فردية وجماعية مع كوتشز معتمدين تدرّبوا على منهجية التفكير الحسّي®'
      : 'Individual and group coaching sessions with certified coaches trained in the Somatic Thinking® methodology',
  };
}

const coachingTypes = [
  {
    slug: 'individual',
    titleAr: 'كوتشينج فردي',
    titleEn: 'Individual Coaching',
    descAr: 'جلسات خاصة مع كوتش معتمد في التفكير الحسّي® — مصمّمة لاحتياجاتك الشخصية والمهنية.',
    descEn: 'Private sessions with a certified Somatic Thinking® coach — designed for your personal and professional needs.',
    iconPath: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    features: {
      ar: ['٦٠ دقيقة لكل جلسة', 'أونلاين أو حضوري', 'خطة مخصصة لكل عميل', 'متابعة بين الجلسات'],
      en: ['60 minutes per session', 'Online or in-person', 'Customized plan for each client', 'Follow-up between sessions'],
    },
  },
  {
    slug: 'group',
    titleAr: 'ورش جماعية',
    titleEn: 'Group Workshops',
    descAr: 'تجارب تعلّم حيّة في مجموعات صغيرة — الجسد يتحرّك، والأفكار تتبلور، والتغيير يبدأ.',
    descEn: 'Live learning experiences in small groups — the body moves, ideas crystallize, and change begins.',
    iconPath: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
    features: {
      ar: ['٤-١٢ مشترك', 'تمارين حسّية تطبيقية', 'بيئة آمنة للاستكشاف', 'شهادة حضور'],
      en: ['4-12 participants', 'Applied somatic exercises', 'Safe space for exploration', 'Certificate of attendance'],
    },
  },
  {
    slug: 'corporate',
    titleAr: 'حلول المؤسسات',
    titleEn: 'Corporate Solutions',
    descAr: 'برامج مصمّمة للقادة والفرق والمؤسسات — لأن القيادة تبدأ من الجسد.',
    descEn: 'Programs designed for leaders, teams, and organizations — because leadership begins in the body.',
    iconPath: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    features: {
      ar: ['تقييم احتياجات مخصص', 'كوتشينج تنفيذي ١:١', 'ورش فريق ومنظومة', 'تقرير نتائج موثّق'],
      en: ['Customized needs assessment', '1:1 Executive coaching', 'Team & system workshops', 'Documented results report'],
    },
  },
];

export default async function CoachingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden py-16 md:py-28">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, #1D1A3D 100%)' }} />
        <GeometricPattern pattern="flower-of-life" opacity={0.06} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center animate-fade-up">
          <p className="text-[var(--color-accent)] font-medium text-sm uppercase tracking-wider mb-4">
            {isAr ? 'جلسات كوتشينج' : 'Coaching Sessions'}
          </p>
          <h1
            className="text-[2.5rem] md:text-[4rem] font-bold text-[#FFF5E9] leading-[1.05]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'الكوتشينج' : 'Coaching'}
          </h1>
          <p className="mt-6 text-white/70 max-w-2xl mx-auto text-lg md:text-xl leading-relaxed">
            {isAr
              ? 'جلسات كوتشينج مع كوتشز معتمدين تدرّبوا على منهجية التفكير الحسّي® — الجسد يقود، والتغيير يبدأ'
              : 'Coaching sessions with certified coaches trained in Somatic Thinking® — the body leads, change begins'}
          </p>
        </div>
      </section>

      {/* Coaching Types */}
      <Section variant="white">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {coachingTypes.map((type) => (
            <a key={type.slug} href={`/${locale}/coaching/${type.slug}`} className="group">
              <Card accent className="p-6 h-full transition-all duration-300 group-hover:shadow-[0_12px_40px_rgba(71,64,153,0.12)] group-hover:-translate-y-1">
                {/* Icon */}
                <div className="h-14 w-14 rounded-2xl bg-[var(--color-primary-50)] flex items-center justify-center mb-5">
                  <svg className="w-7 h-7 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d={type.iconPath} />
                  </svg>
                </div>

                <h2
                  className="text-xl font-bold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] transition-colors mb-2"
                  style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
                >
                  {isAr ? type.titleAr : type.titleEn}
                </h2>
                <p className="text-sm text-[var(--color-neutral-600)] mb-5 leading-relaxed">
                  {isAr ? type.descAr : type.descEn}
                </p>

                {/* Features */}
                <ul className="space-y-2">
                  {(isAr ? type.features.ar : type.features.en).map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-[var(--color-neutral-700)]">
                      <svg className="w-4 h-4 shrink-0 mt-0.5 text-[var(--color-accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <div className="mt-6 pt-4 border-t border-[var(--color-neutral-100)]">
                  <span className="text-sm font-semibold text-[var(--color-accent)] group-hover:text-[var(--color-accent-500)] transition-colors">
                    {isAr ? 'المزيد' : 'Learn More'} <ArrowRight className="w-4 h-4 inline-block rtl:rotate-180" aria-hidden="true" />
                  </span>
                </div>
              </Card>
            </a>
          ))}
        </div>
      </Section>

      {/* Book CTA */}
      <Section variant="surface">
        <div className="text-center py-4">
          <h2
            className="text-xl md:text-2xl font-bold text-[var(--text-primary)] mb-3"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'جاهز تبدأ؟' : 'Ready to Start?'}
          </h2>
          <p className="text-[var(--color-neutral-600)] mb-6 max-w-xl mx-auto">
            {isAr
              ? 'احجز جلستك الآن مع أحد كوتشز أكاديمية كُن المعتمدين'
              : 'Book your session now with one of Kun Academy\'s certified coaches'}
          </p>
          <a
            href={`/${locale}/coaching/book`}
            className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-8 py-3.5 text-base font-semibold text-white min-h-[52px] hover:bg-[var(--color-accent-500)] transition-all duration-300 shadow-[0_4px_24px_rgba(228,96,30,0.35)]"
          >
            {isAr ? 'احجز جلسة' : 'Book a Session'}
          </a>
        </div>
      </Section>
    </main>
  );
}
