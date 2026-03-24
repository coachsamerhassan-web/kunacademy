import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';

export default async function Level4Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="default" className="min-h-[50vh] flex items-center">
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-[var(--color-accent)] font-medium mb-2">
            {isAr ? 'STCE — المستوى ٤' : 'STCE — Level 4'}
          </p>
          <Heading level={1}>
            {isAr ? 'STOC — الإشراف على الكوتشينج' : 'STOC — Somatic Thinking Oversight of Coaching'}
          </Heading>
          <p className="mt-4 text-lg text-[var(--color-neutral-700)]">
            {isAr ? '٣٧ ساعة تدريبية' : '37 training hours'}
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
                'مهارات الإشراف والمنتورينج المتقدمة',
                'تقييم أداء الكوتشز وتقديم تغذية راجعة بنّاءة',
                'الإرشاد نحو شهادات ICF (ACC/PCC/MCC)',
                'بناء ثقافة التطوير المستمر',
              ]
              : [
                'Advanced supervision and mentoring skills',
                'Evaluating coach performance and providing constructive feedback',
                'Guiding coaches toward ICF credentials (ACC/PCC/MCC)',
                'Building a culture of continuous development',
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
            {isAr ? 'قُد الجيل القادم' : 'Lead the Next Generation'}
          </Heading>
          <p className="mt-4 text-white/80 max-w-xl mx-auto">
            {isAr
              ? 'يتطلب إتمام المستوى الثالث — كن مشرفًا ومنتورًا معتمدًا'
              : 'Requires completion of Level 3 — become a certified supervisor and mentor'}
          </p>
          <Button variant="primary" size="lg" className="mt-6">
            {isAr ? 'سجّل الآن' : 'Register Now'}
          </Button>
        </div>
      </Section>
    </main>
  );
}
