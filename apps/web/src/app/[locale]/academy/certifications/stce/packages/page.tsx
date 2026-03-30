import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'باقات STCE | أكاديمية كُن' : 'STCE Packages | Kun Academy',
    description: isAr ? 'اختر الباقة المناسبة لرحلتك في شهادة التفكير الحسّي للكوتشينج' : 'Choose the right package for your Somatic Thinking Coaching Education journey',
  };
}

export default async function STCEPackagesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  const packages = isAr
    ? [
      {
        name: 'الباقة المهنية',
        levels: 'المستوى ١ + ٢',
        hours: '١٤٤ ساعة',
        desc: 'للكوتشز الذين يريدون بناء ممارسة مهنية قوية مع اعتماد ICF',
        highlight: false,
      },
      {
        name: 'باقة الإتقان',
        levels: 'المستوى ١ + ٢ + ٣ + ٤',
        hours: '٢٢٠ ساعة',
        desc: 'المسار الكامل — من المبتدئ إلى المشرف المعتمد',
        highlight: true,
      },
    ]
    : [
      {
        name: 'Professional Package',
        levels: 'Level 1 + 2',
        hours: '144 hours',
        desc: 'For coaches building a strong professional practice with ICF accreditation',
        highlight: false,
      },
      {
        name: 'Mastery Package',
        levels: 'Level 1 + 2 + 3 + 4',
        hours: '220 hours',
        desc: 'The complete path — from beginner to certified supervisor',
        highlight: true,
      },
    ];

  return (
    <main>
      <section className="relative overflow-hidden py-16 md:py-24" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <GeometricPattern pattern="flower-of-life" opacity={0.08} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h1 className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]" style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
            {isAr ? 'باقات STCE' : 'STCE Packages'}
          </h1>
          <p className="mt-4 text-white/65 max-w-2xl mx-auto text-lg md:text-xl">
            {isAr ? 'وفّر أكثر واحصل على مسار تعليمي متكامل' : 'Save more and get a complete learning journey'}
          </p>
        </div>
      </section>

      <Section variant="white">
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {packages.map((pkg, i) => (
            <div
              key={i}
              className={`rounded-[var(--card-radius)] p-8 text-center ${
                pkg.highlight
                  ? 'bg-[var(--color-primary)] text-white shadow-lg'
                  : 'bg-white border border-[var(--color-neutral-200)] shadow-sm'
              }`}
            >
              {pkg.highlight && (
                <span className="inline-block bg-white/20 text-white text-sm font-medium px-3 py-1 rounded-full mb-4">
                  {isAr ? 'الأكثر طلبًا' : 'Most Popular'}
                </span>
              )}
              <h3 className="text-2xl font-bold">{pkg.name}</h3>
              <p className={`mt-2 text-sm ${pkg.highlight ? 'text-white/80' : 'text-[var(--color-accent)]'}`}>
                {pkg.levels} | {pkg.hours}
              </p>
              <p className={`mt-4 ${pkg.highlight ? 'text-white/90' : 'text-[var(--color-neutral-600)]'}`}>
                {pkg.desc}
              </p>
              <Button
                variant={pkg.highlight ? 'secondary' : 'primary'}
                size="lg"
                className="mt-6"
              >
                {isAr ? 'اختر هذه الباقة' : 'Choose This Package'}
              </Button>
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}
