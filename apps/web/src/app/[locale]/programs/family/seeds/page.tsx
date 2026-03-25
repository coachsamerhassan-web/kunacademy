import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';

export default async function SeedsYouthPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  const ageGroups = isAr
    ? [
      { age: '٨–١١', title: 'البراعم', desc: 'اكتشاف الجسد والمشاعر من خلال اللعب والحركة' },
      { age: '١٢–١٥', title: 'المستكشفون', desc: 'بناء الوعي بالإشارات الحسّية الجسدية وإدارة الانفعالات' },
      { age: '١٦–١٨', title: 'القادة', desc: 'تطوير مهارات التواصل والقيادة الحسّية' },
    ]
    : [
      { age: '8–11', title: 'Sprouts', desc: 'Discovering body and emotions through play and movement' },
      { age: '12–15', title: 'Explorers', desc: 'Building awareness of somatic body signals and managing emotions' },
      { age: '16–18', title: 'Leaders', desc: 'Developing communication and somatic leadership skills' },
    ];

  return (
    <main>
      <section className="relative overflow-hidden py-16 md:py-24" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <GeometricPattern pattern="flower-of-life" opacity={0.08} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h1 className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]" style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
            {isAr ? 'بذور — برنامج الشباب' : 'SEEDS — Youth Program'}
          </h1>
          <p className="mt-4 text-white/65 max-w-2xl mx-auto text-lg md:text-xl">
            {isAr ? 'التفكير الحسّي للأجيال الناشئة — ٣ فئات عمرية' : 'Somatic Thinking for the next generation — 3 age groups'}
          </p>
        </div>
      </section>

      <Section variant="white">
        <div className="grid md:grid-cols-3 gap-6">
          {ageGroups.map((group, i) => (
            <div
              key={i}
              className="rounded-[var(--card-radius)] bg-white p-6 shadow-sm border border-[var(--color-neutral-200)] text-center"
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-secondary)] text-white font-bold text-lg">
                {group.age}
              </div>
              <h3 className="font-bold text-xl">{group.title}</h3>
              <p className="text-[var(--color-neutral-600)] mt-2">{group.desc}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-8">
          <Button variant="primary" size="lg">
            {isAr ? 'سجّل طفلك' : 'Register Your Child'}
          </Button>
        </div>
      </Section>
    </main>
  );
}
