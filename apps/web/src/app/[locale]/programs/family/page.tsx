import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { FAQSection, faqJsonLd } from '@kunacademy/ui/faq-section';
import { familyFaqs } from '@/data/faqs';

export default async function FamilyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  const programs = isAr
    ? [
      { title: 'بذور — الشباب', desc: 'برنامج التفكير الحسّي للشباب بثلاث فئات عمرية', href: '/programs/family/seeds' },
      { title: 'بذور ١٠١ — الكبار', desc: 'مقدمة في التفكير الحسّي للآباء والأمهات', href: '/programs/family/seeds-adults' },
      { title: 'وِصال — كوتشينج الأسرة', desc: 'كوتشينج أسري قائم على الإشارات الحسّية الجسدية', href: '/programs/family/wisal' },
    ]
    : [
      { title: 'SEEDS — Youth', desc: 'Somatic Thinking program for youth in 3 age groups', href: '/programs/family/seeds' },
      { title: 'SEEDS 101 — Adults', desc: 'Introduction to Somatic Thinking for parents', href: '/programs/family/seeds-adults' },
      { title: 'Wisal — Family Coaching', desc: 'Family coaching based on somatic body signals', href: '/programs/family/wisal' },
    ];

  return (
    <main>
      <Section variant="default" className="min-h-[50vh] flex items-center">
        <div className="text-center max-w-3xl mx-auto">
          <Heading level={1}>
            {isAr ? 'برامج الأسرة والشباب' : 'Family & Youth Programs'}
          </Heading>
          <p className="mt-4 text-lg text-[var(--color-neutral-700)]">
            {isAr
              ? 'التفكير الحسّي لكل أفراد الأسرة — من الأطفال إلى الآباء'
              : 'Somatic Thinking for the whole family — from children to parents'}
          </p>
        </div>
      </Section>

      
      <Section variant="white">
        <FAQSection items={familyFaqs} locale={locale} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(familyFaqs, locale)) }}
        />
      </Section>

      <Section variant="white">
        <div className="grid md:grid-cols-3 gap-6">
          {programs.map((program, i) => (
            <div
              key={i}
              className="rounded-[var(--card-radius)] bg-white p-6 shadow-sm hover:shadow-md transition-shadow border border-[var(--color-neutral-200)]"
            >
              <h3 className="font-bold text-xl mb-2">{program.title}</h3>
              <p className="text-[var(--color-neutral-600)]">{program.desc}</p>
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}
