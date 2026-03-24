import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';

export default async function Level2Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="default" className="min-h-[50vh] flex items-center">
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-[var(--color-accent)] font-medium mb-2">
            {isAr ? 'STCE — المستوى ٢' : 'STCE — Level 2'}
          </p>
          <Heading level={1}>
            {isAr ? 'STAIC — التفكير الحسّي المتقدم' : 'STAIC — Somatic Thinking Advanced Integrated Coaching'}
          </Heading>
          <p className="mt-4 text-lg text-[var(--color-neutral-700)]">
            {isAr ? '١٠٦ ساعات تدريبية | معتمد من ICF Level 2' : '106 training hours | ICF Level 2 Accredited'}
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
                'أدوات التفكير الحسّي المتقدمة',
                'التعامل مع المشاعر العميقة والأنماط الجسدية المعقّدة',
                'الكوتشينج التكاملي: دمج العقل والجسد والنَّفْس',
                'بناء ممارسة كوتشينج مستدامة',
                'الإشراف المتقدم والتغذية الراجعة المكثّفة',
              ]
              : [
                'Advanced Somatic Thinking tools and frameworks',
                'Working with deep emotions and complex somatic patterns',
                'Integrative coaching: mind, body, and self',
                'Building a sustainable coaching practice',
                'Advanced supervision and intensive feedback',
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
            {isAr ? 'جاهز للمستوى التالي؟' : 'Ready for the Next Level?'}
          </Heading>
          <p className="mt-4 text-white/80 max-w-xl mx-auto">
            {isAr
              ? 'يتطلب إتمام المستوى الأول — سجّل في الدفعة القادمة'
              : 'Requires completion of Level 1 — register for the next cohort'}
          </p>
          <Button variant="primary" size="lg" className="mt-6">
            {isAr ? 'سجّل الآن' : 'Register Now'}
          </Button>
        </div>
      </Section>
    </main>
  );
}
