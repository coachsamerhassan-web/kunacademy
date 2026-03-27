import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { FAQSection } from '@kunacademy/ui/faq-section';
import { faqJsonLd } from '@kunacademy/ui/faq-jsonld';
import { familyFaqs } from '@/data/faqs';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'برامج الأسرة والشباب | أكاديمية كُن' : 'Family & Youth Programs | Kun Academy',
    description: isAr ? 'برامج SEEDS وويصال — بناء وعي حسّي للعائلات والشباب' : 'SEEDS and Wisal programs — building somatic awareness for families and youth',
  };
}

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
      <section className="relative overflow-hidden py-16 md:py-24" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <GeometricPattern pattern="flower-of-life" opacity={0.08} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h1 className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]" style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
            {isAr ? 'برامج الأسرة والشباب' : 'Family & Youth Programs'}
          </h1>
          <p className="mt-4 text-white/65 max-w-2xl mx-auto text-lg md:text-xl">
            {isAr ? 'التفكير الحسّي لكل أفراد الأسرة — من الأطفال إلى الآباء' : 'Somatic Thinking for the whole family — from children to parents'}
          </p>
        </div>
      </section>

      
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
