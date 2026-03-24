import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';

export default async function Level3Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="default" className="min-h-[50vh] flex items-center">
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-[var(--color-accent)] font-medium mb-2">
            {isAr ? 'STCE — المستوى ٣' : 'STCE — Level 3'}
          </p>
          <Heading level={1}>
            {isAr ? 'STGC — كوتشينج المجموعات' : 'STGC — Somatic Thinking Group Coaching'}
          </Heading>
          <p className="mt-4 text-lg text-[var(--color-neutral-700)]">
            {isAr ? '٣٤ ساعة تدريبية' : '34 training hours'}
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
                'ديناميكيات المجموعة والإشارات الحسّية الجسدية الجماعية',
                'تصميم وتيسير جلسات كوتشينج جماعية فعّالة',
                'إدارة التفاعل الجماعي بوعي حسّي',
                'التعامل مع التحديات في بيئة المجموعة',
              ]
              : [
                'Group dynamics and collective somatic body signals',
                'Designing and facilitating effective group coaching sessions',
                'Managing group interaction with somatic awareness',
                'Handling challenges in the group coaching environment',
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
            {isAr ? 'وسّع تأثيرك' : 'Expand Your Impact'}
          </Heading>
          <p className="mt-4 text-white/80 max-w-xl mx-auto">
            {isAr
              ? 'يتطلب إتمام المستوى الثاني — انقل مهاراتك إلى بيئة المجموعات'
              : 'Requires completion of Level 2 — bring your skills to group settings'}
          </p>
          <Button variant="primary" size="lg" className="mt-6">
            {isAr ? 'سجّل الآن' : 'Register Now'}
          </Button>
        </div>
      </Section>
    </main>
  );
}
