import { setRequestLocale } from 'next-intl/server';
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
      <Section variant="default" className="min-h-[50vh] flex items-center">
        <div className="text-center max-w-3xl mx-auto">
          <Heading level={1}>
            {isAr ? 'بذور — برنامج الشباب' : 'SEEDS — Youth Program'}
          </Heading>
          <p className="mt-4 text-lg text-[var(--color-neutral-700)]">
            {isAr
              ? 'التفكير الحسّي للأجيال الناشئة — ٣ فئات عمرية'
              : 'Somatic Thinking for the next generation — 3 age groups'}
          </p>
        </div>
      </Section>

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
