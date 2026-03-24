import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { FAQSection, faqJsonLd } from '@kunacademy/ui/faq-section';
import { freeFaqs } from '@/data/faqs';

export default async function FreeResourcesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="default" className="min-h-[50vh] flex items-center">
        <div className="text-center max-w-3xl mx-auto">
          <Heading level={1}>
            {isAr ? 'موارد مجانية' : 'Free Resources'}
          </Heading>
          <p className="mt-4 text-lg text-[var(--color-neutral-700)]">
            {isAr
              ? 'اكتشف منهجية التفكير الحسّي مجانًا — دورات تمهيدية، مقالات، وأدوات'
              : 'Discover the Somatic Thinking methodology for free — introductory courses, articles, and tools'}
          </p>
        </div>
      </Section>

      
      <Section variant="white">
        <FAQSection items={freeFaqs} locale={locale} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(freeFaqs, locale)) }}
        />
      </Section>

      <Section variant="white">
        <div className="grid md:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="rounded-[var(--card-radius)] bg-white p-6 shadow-sm border border-[var(--color-neutral-200)]"
            >
              <div className="h-32 bg-[var(--color-neutral-100)] rounded mb-4 flex items-center justify-center">
                <span className="text-[var(--color-neutral-400)]">
                  {isAr ? 'صورة' : 'Image'}
                </span>
              </div>
              <h3 className="font-bold">
                {isAr ? `مورد مجاني ${i}` : `Free Resource ${i}`}
              </h3>
              <p className="text-sm text-[var(--color-secondary)] mt-1">
                {isAr ? 'مجاني' : 'Free'}
              </p>
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}
