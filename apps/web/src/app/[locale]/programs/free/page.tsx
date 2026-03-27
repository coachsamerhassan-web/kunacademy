import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { FAQSection } from '@kunacademy/ui/faq-section';
import { faqJsonLd } from '@kunacademy/ui/faq-jsonld';
import { freeFaqs } from '@/data/faqs';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'موارد مجانية | أكاديمية كُن' : 'Free Resources | Kun Academy',
    description: isAr
      ? 'اكتشف منهجية التفكير الحسّي مجانًا — دورات تمهيدية، مقالات، وأدوات'
      : 'Discover the Somatic Thinking methodology for free — introductory courses, articles, and tools',
  };
}

export default async function FreeResourcesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <section className="relative overflow-hidden py-16 md:py-24" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <GeometricPattern pattern="flower-of-life" opacity={0.08} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h1 className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]" style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
            {isAr ? 'موارد مجانية' : 'Free Resources'}
          </h1>
          <p className="mt-4 text-white/65 max-w-2xl mx-auto text-lg md:text-xl">
            {isAr ? 'اكتشف منهجية التفكير الحسّي مجانًا — دورات تمهيدية، مقالات، وأدوات' : 'Discover the Somatic Thinking methodology for free — introductory courses, articles, and tools'}
          </p>
        </div>
      </section>

      
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
