import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';
import { FAQSection, faqJsonLd } from '@kunacademy/ui/faq-section';
import { coachingFaqs } from '@/data/faqs';

export default async function CoachingPlatformPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  const tiers = isAr
    ? [
      { name: 'جلسة واحدة', price: '—', desc: 'جلسة كوتشينج فردية مع كوتش معتمد', highlight: false },
      { name: 'باقة ٥ جلسات', price: '—', desc: 'رحلة تطوير مركّزة مع متابعة', highlight: true },
      { name: 'باقة ١٠ جلسات', price: '—', desc: 'تحوّل شامل مع كوتش مخصّص', highlight: false },
    ]
    : [
      { name: 'Single Session', price: '—', desc: 'One-on-one coaching with a certified coach', highlight: false },
      { name: '5-Session Package', price: '—', desc: 'Focused development journey with follow-up', highlight: true },
      { name: '10-Session Package', price: '—', desc: 'Comprehensive transformation with a dedicated coach', highlight: false },
    ];

  return (
    <main>
      <Section variant="default" className="min-h-[50vh] flex items-center">
        <div className="text-center max-w-3xl mx-auto">
          <Heading level={1}>
            {isAr ? 'منصة الكوتشينج' : 'Coaching Platform'}
          </Heading>
          <p className="mt-4 text-lg text-[var(--color-neutral-700)]">
            {isAr
              ? 'احجز جلسة كوتشينج مع كوتشز معتمدين من أكاديمية كُن'
              : 'Book a coaching session with certified Kun Academy coaches'}
          </p>
        </div>
      </Section>

      <Section variant="white">
        <div className="text-center mb-8">
          <Heading level={2}>{isAr ? 'الباقات' : 'Pricing Tiers'}</Heading>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {tiers.map((tier, i) => (
            <div
              key={i}
              className={`rounded-[var(--card-radius)] p-6 text-center ${
                tier.highlight
                  ? 'bg-[var(--color-primary)] text-white shadow-lg'
                  : 'bg-white border border-[var(--color-neutral-200)] shadow-sm'
              }`}
            >
              <h3 className="font-bold text-xl">{tier.name}</h3>
              <p className={`mt-2 ${tier.highlight ? 'text-white/80' : 'text-[var(--color-neutral-600)]'}`}>
                {tier.desc}
              </p>
              <Button
                variant={tier.highlight ? 'secondary' : 'primary'}
                className="mt-6"
              >
                {isAr ? 'احجز الآن' : 'Book Now'}
              </Button>
            </div>
          ))}
        </div>
      </Section>

      
      <Section variant="white">
        <FAQSection items={coachingFaqs} locale={locale} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(coachingFaqs, locale)) }}
        />
      </Section>

      <Section variant="default">
        <div className="text-center">
          <Heading level={2}>{isAr ? 'تصفّح الكوتشز' : 'Browse Coaches'}</Heading>
          <p className="mt-4 text-[var(--color-neutral-600)]">
            {isAr ? 'دليل الكوتشز المعتمدين — قريبًا' : 'Certified coach directory — coming soon'}
          </p>
        </div>
      </Section>
    </main>
  );
}
