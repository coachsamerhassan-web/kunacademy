import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';

export default async function Level1Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="default" className="min-h-[50vh] flex items-center">
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-[var(--color-accent)] font-medium mb-2">
            {isAr ? 'STCE — المستوى ١' : 'STCE — Level 1'}
          </p>
          <Heading level={1}>
            {isAr ? 'STIC — مقدمة في التفكير الحسّي' : 'STIC — Somatic Thinking Introduction to Coaching'}
          </Heading>
          <p className="mt-4 text-lg text-[var(--color-neutral-700)]">
            {isAr ? '٧٩ ساعة تدريبية | معتمد من ICF Level 1' : '79 training hours | ICF Level 1 Accredited'}
          </p>
        </div>
      </Section>

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
