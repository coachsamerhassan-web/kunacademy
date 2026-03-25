import { setRequestLocale } from 'next-intl/server';
import { PageHero } from '@/components/page-hero';

import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { FAQSection } from '@kunacademy/ui/faq-section';
import { faqJsonLd } from '@kunacademy/ui/faq-jsonld';
import { bookingFaqs } from '@/data/faqs';
import { BookingWizard } from './booking-wizard';

export default async function BookingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>

      <PageHero
        locale={locale}
        titleAr="جلسات كوتشينج فردية"
        titleEn="Individual Coaching Sessions"
        subtitleAr="اختر الكوتش المناسب واحجز جلستك"
        subtitleEn="Choose your coach and book your session"
        eyebrowAr="احجز جلستك"
        eyebrowEn="Book a Session"
        pattern="girih"
      />
      <Section variant="default">
        <div className="text-center max-w-2xl mx-auto">
          <Heading level={1}>{isAr ? 'احجز جلسة كوتشينج' : 'Book a Coaching Session'}</Heading>
          <p className="mt-4 text-[var(--color-neutral-600)]">
            {isAr ? 'اختر الخدمة والكوتش والموعد المناسب' : 'Choose your service, coach, and preferred time'}
          </p>
        </div>
      </Section>

      <Section variant="white">
        <BookingWizard locale={locale} />
      </Section>

      <Section variant="default">
        <FAQSection items={bookingFaqs} locale={locale} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(bookingFaqs, locale)) }} />
      </Section>
    </main>
  );
}
