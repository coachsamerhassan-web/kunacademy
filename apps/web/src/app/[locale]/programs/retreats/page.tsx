import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { FAQSection } from '@kunacademy/ui/faq-section';
import { faqJsonLd } from '@kunacademy/ui/faq-jsonld';
import { retreatsFaqs } from '@/data/faqs';

export default async function RetreatsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <section className="relative overflow-hidden py-16 md:py-24" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <GeometricPattern pattern="flower-of-life" opacity={0.08} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h1 className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]" style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
            {isAr ? 'الخلوات والمعتكفات' : 'Retreats'}
          </h1>
          <p className="mt-4 text-white/65 max-w-2xl mx-auto text-lg md:text-xl">
            {isAr ? 'تجارب غامرة تجمع بين التفكير الحسّي والطبيعة والتأمّل' : 'Immersive experiences combining Somatic Thinking, nature, and reflection'}
          </p>
        </div>
      </section>

      
      <Section variant="white">
        <FAQSection items={retreatsFaqs} locale={locale} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(retreatsFaqs, locale)) }}
        />
      </Section>

      <Section variant="white">
        <div className="grid md:grid-cols-2 gap-8">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-[var(--card-radius)] overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="h-48 bg-[var(--color-neutral-100)] flex items-center justify-center">
                <span className="text-[var(--color-neutral-400)]">
                  {isAr ? 'صورة الخلوة' : 'Retreat Image'}
                </span>
              </div>
              <div className="p-6">
                <h3 className="font-bold text-lg">
                  {isAr ? `خلوة ${i}` : `Retreat ${i}`}
                </h3>
                <p className="text-[var(--color-neutral-600)] mt-2">
                  {isAr ? 'التفاصيل قريبًا' : 'Details coming soon'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}
