import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';
import { courseJsonLd, breadcrumbJsonLd } from '@kunacademy/ui/structured-data';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'منتورينج متقدم — MCC | أكاديمية كُن' : 'Advanced MCC Mentoring | Kun Academy',
    description: isAr
      ? 'جلسات منتورينج فردية مع سامر حسن (MCC) — ساعات مؤهّلة لتجديد شهادات ICF'
      : 'Individual mentoring sessions with Samer Hassan (MCC) — qualifying hours for ICF credential renewal',
  };
}

export default async function MCCMentoringPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(courseJsonLd({
          locale,
          name: isAr ? 'منتورينج متقدم — MCC' : 'Advanced MCC Mentoring',
          description: isAr
            ? 'جلسات منتورينج فردية مع سامر حسن (MCC) — ساعات مؤهّلة لتجديد شهادات ICF'
            : 'Individual mentoring sessions with Samer Hassan (MCC) — qualifying hours for ICF credential renewal',
          slug: 'academy/certifications/mcc-mentoring',
          hours: 10,
        })) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(locale, [
          { name: isAr ? 'الرئيسية' : 'Home', path: '' },
          { name: isAr ? 'الأكاديمية' : 'Academy', path: '/academy' },
          { name: isAr ? 'الشهادات' : 'Certifications', path: '/academy/certifications' },
          { name: isAr ? 'منتورينج متقدم' : 'MCC Mentoring', path: '/academy/certifications/mcc-mentoring' },
        ])) }}
      />
      <section className="relative overflow-hidden py-16 md:py-24" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <GeometricPattern pattern="flower-of-life" opacity={0.08} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h1 className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]" style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
            {isAr ? 'منتورينج متقدم' : 'Advanced Mentoring'}
          </h1>
          <p className="mt-4 text-white/65 max-w-2xl mx-auto text-lg md:text-xl">
            {isAr ? 'منتورينج متقدم' : 'Advanced Mentoring'}
          </p>
        </div>
      </section>

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
