import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { FAQSection } from '@kunacademy/ui/faq-section';
import { faqJsonLd } from '@kunacademy/ui/faq-jsonld';
import { contactFaqs } from '@/data/faqs';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { ContactForm } from '@/components/contact-form';
import { createPageMetadata } from '@/lib/og-metadata';

export const metadata = createPageMetadata({
  title: 'Contact Us',
  titleAr: 'تواصل معنا',
  description: 'Get in touch with Kun Coaching Academy. Dubai, UAE.',
  path: '/contact',
  type: 'default',
});

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden py-16 md:py-24" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <GeometricPattern pattern="flower-of-life" opacity={0.08} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h1
            className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'تواصل معنا' : 'Contact Us'}
          </h1>
          <p className="mt-4 text-white/70 max-w-lg mx-auto text-lg md:text-xl">
            {isAr
              ? 'نسعد بتواصلك. املأ النموذج أدناه وسنردّ عليك في أقرب وقت.'
              : 'We would love to hear from you. Fill out the form below and we will get back to you shortly.'}
          </p>
        </div>
      </section>

      {/* Contact form + info grid */}
      <Section variant="surface">
        <div className="grid md:grid-cols-5 gap-10 md:gap-12">
          {/* Form — 3 cols */}
          <div className="md:col-span-3 relative">
            <ContactForm locale={locale} />
          </div>

          {/* Contact info — 2 cols */}
          <div className="md:col-span-2 space-y-6">
            {/* Info cards */}
            {[
              {
                iconPath: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
                labelAr: 'البريد الإلكتروني',
                labelEn: 'Email',
                value: 'info@kunacademy.com',
                href: 'mailto:info@kunacademy.com',
              },
              {
                iconPath: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
                labelAr: 'الهاتف',
                labelEn: 'Phone',
                value: '+971 50 123 4567',
                href: 'tel:+971501234567',
              },
              {
                iconPath: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
                labelAr: 'العنوان',
                labelEn: 'Address',
                value: isAr ? 'منطقة ميدان الحرة — دبي، الإمارات' : 'Meydan Free Zone — Dubai, UAE',
                href: null,
              },
            ].map((info) => (
              <div key={info.labelEn} className="flex gap-4 p-4 rounded-2xl bg-white shadow-[0_2px_12px_rgba(71,64,153,0.05)]">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[var(--color-primary-50)] flex items-center justify-center">
                  <svg className="w-5 h-5 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d={info.iconPath} />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[var(--color-neutral-500)] uppercase tracking-wide">
                    {isAr ? info.labelAr : info.labelEn}
                  </p>
                  {info.href ? (
                    <a href={info.href} className="text-sm font-medium text-[var(--color-primary)] hover:underline break-all">
                      {info.value}
                    </a>
                  ) : (
                    <p className="text-sm font-medium text-[var(--color-neutral-800)] break-words">
                      {info.value}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* WhatsApp CTA */}
            <a
              href="https://wa.me/971501234567"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 w-full rounded-xl bg-[#25D366] px-6 py-3.5 text-white font-semibold min-h-[48px] hover:bg-[#20BD5A] transition-all duration-300 shadow-[0_4px_16px_rgba(37,211,102,0.25)]"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.5 14.4l-2-1c-.3-.1-.5-.2-.7.1l-1 1.2c-.2.2-.3.2-.6.1-.3-.2-1.2-.4-2.2-1.4-.8-.8-1.4-1.7-1.5-2 0-.3 0-.4.2-.5l.4-.5.3-.4v-.5l-1-2.3c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.2-1.2 2.8s1.2 3.3 1.4 3.5c.2.2 2.4 3.6 5.8 5.1.8.3 1.5.5 2 .7.8.3 1.6.2 2.2.1.7-.1 2-.8 2.3-1.6.3-.8.3-1.4.2-1.6-.1-.1-.3-.2-.6-.3z" />
              </svg>
              {isAr ? 'تواصل عبر واتساب' : 'Chat on WhatsApp'}
            </a>
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section variant="white">
        <div className="text-center mb-10">
          <h2 className="text-[1.75rem] md:text-[2.5rem] font-bold text-[var(--text-accent)]">
            {isAr ? 'أسئلة شائعة' : 'Frequently Asked Questions'}
          </h2>
        </div>
        <FAQSection items={contactFaqs} locale={locale} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(contactFaqs, locale)) }}
        />
      </Section>
    </>
  );
}
