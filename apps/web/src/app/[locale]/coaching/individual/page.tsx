import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Card } from '@kunacademy/ui/card';
import { breadcrumbJsonLd } from '@kunacademy/ui/structured-data';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'كوتشينج فردي | أكاديمية كُن' : 'Individual Coaching | Kun Academy',
    description: isAr
      ? 'جلسات كوتشينج فردية مع كوتشز معتمدين في التفكير الحسّي® — تحوّل حقيقي يبدأ من الجسد'
      : 'Individual coaching sessions with certified Somatic Thinking® coaches — real transformation that starts from the body',
  };
}

const howItWorks = [
  {
    stepAr: '١', stepEn: '1',
    titleAr: 'اختر كوتشك', titleEn: 'Choose Your Coach',
    descAr: 'تصفّح كوتشز أكاديمية كُن المعتمدين واختر من يناسب أهدافك وتخصصك.',
    descEn: 'Browse Kun Academy\'s certified coaches and choose one that matches your goals.',
  },
  {
    stepAr: '٢', stepEn: '2',
    titleAr: 'احجز جلستك', titleEn: 'Book Your Session',
    descAr: 'اختر الموعد المناسب من التقويم — أونلاين عبر Zoom أو حضوريًا في دبي.',
    descEn: 'Pick a convenient time from the calendar — online via Zoom or in-person in Dubai.',
  },
  {
    stepAr: '٣', stepEn: '3',
    titleAr: 'ابدأ رحلتك', titleEn: 'Start Your Journey',
    descAr: 'في الجلسة الأولى نستكشف معًا أهدافك ونبني خارطة طريق واضحة للتغيير.',
    descEn: 'In the first session we explore your goals together and build a clear roadmap for change.',
  },
];

const benefits = [
  {
    titleAr: 'الجسد يقود', titleEn: 'The Body Leads',
    descAr: 'ليس كوتشينج تقليدي — نبدأ من الإشارات الحسّية الجسدية لنصل إلى رؤية أعمق.',
    descEn: 'Not traditional coaching — we start from somatic signals to reach deeper insight.',
  },
  {
    titleAr: 'كوتشز معتمدون', titleEn: 'Certified Coaches',
    descAr: 'جميع كوتشز كُن خريجو برنامج STCE ومعتمدون من ICF.',
    descEn: 'All Kun coaches are STCE graduates and ICF-accredited.',
  },
  {
    titleAr: 'نتائج قابلة للقياس', titleEn: 'Measurable Results',
    descAr: 'تقييم قبل وبعد. خطة عمل واضحة. متابعة مستمرة بين الجلسات.',
    descEn: 'Pre and post assessment. Clear action plan. Continuous follow-up between sessions.',
  },
  {
    titleAr: 'سرّية تامة', titleEn: 'Full Confidentiality',
    descAr: 'كل ما يُقال في الجلسة يبقى في الجلسة — هذا التزامنا الأخلاقي.',
    descEn: 'Everything shared in the session stays in the session — this is our ethical commitment.',
  },
];

export default async function IndividualCoachingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(locale, [
          { name: isAr ? 'الرئيسية' : 'Home', path: '' },
          { name: isAr ? 'الكوتشينج' : 'Coaching', path: '/coaching' },
          { name: isAr ? 'كوتشينج فردي' : 'Individual Coaching', path: '/coaching/individual' },
        ])) }}
      />
      {/* Hero */}
      <section className="relative overflow-hidden py-16 md:py-28">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, #1D1A3D 100%)' }} />
        <GeometricPattern pattern="flower-of-life" opacity={0.06} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6">
          <div className="max-w-2xl animate-fade-up">
            <a href={`/${locale}/coaching`} className="text-[var(--color-accent)] text-sm font-medium hover:underline mb-4 inline-block">
              <ArrowLeft className="w-4 h-4 inline-block rtl:rotate-180" aria-hidden="true" /> {isAr ? 'الكوتشينج' : 'Coaching'}
            </a>
            <h1
              className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.05]"
              style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
            >
              {isAr ? 'كوتشينج فردي' : 'Individual Coaching'}
            </h1>
            <p className="mt-4 text-white/70 text-lg md:text-xl leading-relaxed">
              {isAr
                ? 'جلسة خاصة مع كوتش معتمد في التفكير الحسّي® — مصمّمة لاحتياجاتك، تبدأ من جسدك'
                : 'A private session with a certified Somatic Thinking® coach — designed for your needs, starting from your body'}
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <a
                href={`/${locale}/coaching/book`}
                className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-white min-h-[48px] hover:bg-[var(--color-accent-500)] transition-all duration-300 shadow-[0_4px_24px_rgba(228,96,30,0.35)]"
              >
                {isAr ? 'احجز جلسة' : 'Book a Session'}
              </a>
              <a
                href={`/${locale}/coaches`}
                className="inline-flex items-center justify-center rounded-xl border-2 border-white/30 px-6 py-3 text-sm font-semibold text-white min-h-[48px] hover:bg-white/10 transition-all duration-300"
              >
                {isAr ? 'تصفّح الكوتشز' : 'Browse Coaches'}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <Section variant="white">
        <div className="text-center mb-10">
          <h2
            className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'كيف تبدأ؟' : 'How It Works'}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {howItWorks.map((step, i) => (
            <div key={i} className="text-center">
              <div className="h-14 w-14 rounded-2xl bg-[var(--color-primary)] text-white flex items-center justify-center text-xl font-bold mx-auto mb-4">
                {isAr ? step.stepAr : step.stepEn}
              </div>
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
                {isAr ? step.titleAr : step.titleEn}
              </h3>
              <p className="text-sm text-[var(--color-neutral-600)] leading-relaxed">
                {isAr ? step.descAr : step.descEn}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Benefits */}
      <Section variant="surface">
        <div className="text-center mb-10">
          <h2
            className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'لماذا كوتشينج كُن؟' : 'Why Kun Coaching?'}
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {benefits.map((benefit, i) => (
            <Card key={i} accent className="p-5">
              <h3 className="font-bold text-[var(--text-primary)] mb-2">
                {isAr ? benefit.titleAr : benefit.titleEn}
              </h3>
              <p className="text-sm text-[var(--color-neutral-600)] leading-relaxed">
                {isAr ? benefit.descAr : benefit.descEn}
              </p>
            </Card>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <Section variant="white">
        <div className="text-center py-4">
          <h2
            className="text-xl md:text-2xl font-bold text-[var(--text-primary)] mb-6"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'ابدأ رحلتك اليوم' : 'Start Your Journey Today'}
          </h2>
          <a
            href={`/${locale}/coaching/book`}
            className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-8 py-3.5 text-base font-semibold text-white min-h-[52px] hover:bg-[var(--color-accent-500)] transition-all duration-300 shadow-[0_4px_24px_rgba(228,96,30,0.35)]"
          >
            {isAr ? 'احجز جلستك الأولى' : 'Book Your First Session'}
          </a>
        </div>
      </Section>
    </main>
  );
}
