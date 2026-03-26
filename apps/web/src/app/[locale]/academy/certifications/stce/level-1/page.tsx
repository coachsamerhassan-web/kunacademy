import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';

export default async function Level1Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <section className="relative overflow-hidden py-16 md:py-24" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <GeometricPattern pattern="flower-of-life" opacity={0.08} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h1 className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]" style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
            {isAr ? 'STCE — المستوى ١' : 'STCE — Level 1'}
          </h1>
          <p className="mt-4 text-white/65 max-w-2xl mx-auto text-lg md:text-xl">
            {isAr ? 'STCE — المستوى ١' : 'STCE — Level 1'}
          </p>
        </div>
      </section>

      <Section variant="white">
        <div className="max-w-3xl mx-auto">
          <Heading level={2}>
            {isAr ? 'ماذا ستتعلّم' : 'What You\'ll Learn'}
          </Heading>
          <ul className="mt-6 space-y-4">
            {(isAr
              ? [
                'أساسيات التفكير الحسّي وعلاقته بالكوتشينج',
                'الإشارات الحسّية الجسدية وكيفية قراءتها',
                'مهارات الكوتشينج الجوهرية وفق معايير ICF',
                'بناء جلسة كوتشينج متكاملة',
                'التطبيق العملي والتدريب الإشرافي',
              ]
              : [
                'Fundamentals of Somatic Thinking and its relation to coaching',
                'Somatic body signals and how to read them',
                'Core ICF coaching competencies',
                'Building a complete coaching session',
                'Practical application and supervised practice',
              ]
            ).map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="text-[var(--color-primary)] mt-1 shrink-0">&#10003;</span>
                <span className="text-[var(--color-neutral-700)]">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section variant="dark" pattern>
        <div className="text-center py-8">
          <Heading level={2} className="!text-white">
            {isAr ? 'مستعد للبدء؟' : 'Ready to Begin?'}
          </Heading>
          <p className="mt-4 text-white/80 max-w-xl mx-auto">
            {isAr
              ? 'انضم إلى الدفعة القادمة وابدأ رحلتك في التفكير الحسّي'
              : 'Join the next cohort and begin your Somatic Thinking journey'}
          </p>
          <Button variant="primary" size="lg" className="mt-6">
            {isAr ? 'سجّل الآن' : 'Register Now'}
          </Button>
        </div>
      </Section>
    </main>
  );
}
