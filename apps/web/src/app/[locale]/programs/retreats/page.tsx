import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { FAQSection, faqJsonLd } from '@kunacademy/ui/faq-section';
import { retreatsFaqs } from '@/data/faqs';

export default async function RetreatsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="default" className="min-h-[50vh] flex items-center">
        <div className="text-center max-w-3xl mx-auto">
          <Heading level={1}>
            {isAr ? 'الخلوات والمعتكفات' : 'Retreats'}
          </Heading>
          <p className="mt-4 text-lg text-[var(--color-neutral-700)]">
            {isAr
              ? 'تجارب غامرة تجمع بين التفكير الحسّي والطبيعة والتأمّل'
              : 'Immersive experiences combining Somatic Thinking, nature, and reflection'}
          </p>
        </div>
      </Section>

      
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
