import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';

export default async function MCCMentoringPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="default" className="min-h-[50vh] flex items-center">
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-[var(--color-accent)] font-medium mb-2">
            {isAr ? 'منتورينج متقدم' : 'Advanced Mentoring'}
          </p>
          <Heading level={1}>
            {isAr ? 'منتورينج MCC' : 'MCC Mentoring'}
          </Heading>
          <p className="mt-4 text-lg text-[var(--color-neutral-700)]">
            {isAr
              ? 'ساعات منتورينج مؤهّلة لتجديد شهادات ICF — مع أول عربي MCC'
              : 'Qualifying mentor coaching hours for ICF credential renewal — with the First Arab MCC'}
          </p>
        </div>
      </Section>

      <Section variant="white">
        <div className="max-w-3xl mx-auto">
          <Heading level={2}>
            {isAr ? 'ما يتضمّنه البرنامج' : 'What\'s Included'}
          </Heading>
          <ul className="mt-6 space-y-4">
            {(isAr
              ? [
                'جلسات منتورينج فردية مع سامر حسن (MCC)',
                'ساعات مؤهّلة لتجديد شهادات ACC / PCC / MCC',
                'تقييم مفصّل لمستوى الكوتشينج الحالي',
                'خطة تطوير مخصّصة',
                'تسجيلات وملاحظات مكتوبة لكل جلسة',
              ]
              : [
                'One-on-one mentoring sessions with Samer Hassan (MCC)',
                'Qualifying hours for ACC / PCC / MCC credential renewal',
                'Detailed assessment of current coaching level',
                'Personalized development plan',
                'Recordings and written notes for each session',
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
            {isAr ? 'احجز جلستك' : 'Book Your Session'}
          </Heading>
          <Button variant="primary" size="lg" className="mt-6">
            {isAr ? 'احجز الآن' : 'Book Now'}
          </Button>
        </div>
      </Section>
    </main>
  );
}
