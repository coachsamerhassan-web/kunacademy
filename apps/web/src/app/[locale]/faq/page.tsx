import { setRequestLocale } from 'next-intl/server';
import { PageHero } from '@/components/page-hero';

import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { FAQSection } from '@kunacademy/ui/faq-section';
import { faqJsonLd } from '@kunacademy/ui/faq-jsonld';
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
      <PageHero
        locale={locale}
        titleAr="الأسئلة الشائعة"
        titleEn="Frequently Asked Questions"
        subtitleAr="إجابات على الأسئلة الأكثر شيوعًا حول أكاديمية كُن وبرامجنا"
        subtitleEn="Answers to the most common questions about Kun Academy and our programs"
        eyebrowAr="الدعم"
        eyebrowEn="Support"
        pattern="flower-of-life"
      />

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
