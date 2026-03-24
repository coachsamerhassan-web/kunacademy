import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { FAQSection, faqJsonLd } from '@kunacademy/ui/faq-section';
import {
  programsFaqs,
  stceFaqs,
  methodologyFaqs,
  corporateFaqs,
  familyFaqs,
  coachingFaqs,
  bookingFaqs,
  aboutFaqs,
} from '@/data/faqs';
import type { FAQItem } from '@kunacademy/ui/faq-section';

const allFaqs: FAQItem[] = [
  ...aboutFaqs,
  ...methodologyFaqs,
  ...programsFaqs,
  ...stceFaqs,
  ...coachingFaqs,
  ...corporateFaqs,
  ...familyFaqs,
  ...bookingFaqs,
];

export default async function FAQPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section>
        <Heading level={1}>{isAr ? 'الأسئلة الشائعة' : 'Frequently Asked Questions'}</Heading>
        <p className="mt-4 text-[var(--color-neutral-700)]">
          {isAr
            ? 'إجابات على الأسئلة الأكثر شيوعًا حول أكاديمية كُن وبرامجها.'
            : 'Answers to the most common questions about Kun Academy and its programs.'}
        </p>
      </Section>

      <Section variant="white">
        <FAQSection items={allFaqs} locale={locale} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(allFaqs, locale)) }}
        />
      </Section>
    </main>
  );
}
