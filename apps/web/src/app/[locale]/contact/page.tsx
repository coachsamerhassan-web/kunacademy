import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { FAQSection, faqJsonLd } from '@kunacademy/ui/faq-section';
import { contactFaqs } from '@/data/faqs';

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section>
        <Heading level={1}>{isAr ? 'تواصل معنا' : 'Contact Us'}</Heading>
        <p className="mt-4 text-[var(--color-neutral-700)]">
          {isAr
            ? 'نسعد بتواصلك. املأ النموذج أدناه وسنردّ عليك في أقرب وقت.'
            : 'We would love to hear from you. Fill out the form below and we will get back to you shortly.'}
        </p>
      </Section>

      
      <Section variant="white">
        <FAQSection items={contactFaqs} locale={locale} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(contactFaqs, locale)) }}
        />
      </Section>

      <Section>
        <form className="mx-auto max-w-xl space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-[var(--color-neutral-700)]">
              {isAr ? 'الاسم الكامل' : 'Full Name'}
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              className="mt-1 block w-full rounded-md border border-[var(--color-neutral-300)] px-4 py-3 text-[var(--color-neutral-800)] focus:border-[var(--color-primary)] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[var(--color-neutral-700)]">
              {isAr ? 'البريد الإلكتروني' : 'Email'}
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              className="mt-1 block w-full rounded-md border border-[var(--color-neutral-300)] px-4 py-3 text-[var(--color-neutral-800)] focus:border-[var(--color-primary)] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-[var(--color-neutral-700)]">
              {isAr ? 'رقم الهاتف' : 'Phone Number'}
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              className="mt-1 block w-full rounded-md border border-[var(--color-neutral-300)] px-4 py-3 text-[var(--color-neutral-800)] focus:border-[var(--color-primary)] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-medium text-[var(--color-neutral-700)]">
              {isAr ? 'الرسالة' : 'Message'}
            </label>
            <textarea
              id="message"
              name="message"
              rows={5}
              required
              className="mt-1 block w-full rounded-md border border-[var(--color-neutral-300)] px-4 py-3 text-[var(--color-neutral-800)] focus:border-[var(--color-primary)] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-[var(--color-primary)] px-6 py-3 font-medium text-white hover:opacity-90 transition-opacity"
          >
            {isAr ? 'أرسل الرسالة' : 'Send Message'}
          </button>
        </form>
      </Section>
    </main>
  );
}
