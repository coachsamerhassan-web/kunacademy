import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';
import { FAQSection } from '@kunacademy/ui/faq-section';
import { faqJsonLd } from '@kunacademy/ui/faq-jsonld';
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
      <section className="relative overflow-hidden py-16 md:py-24" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <GeometricPattern pattern="flower-of-life" opacity={0.08} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h1 className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]" style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
            {isAr ? 'منصة الكوتشينج' : 'Coaching Platform'}
          </h1>
          <p className="mt-4 text-white/65 max-w-2xl mx-auto text-lg md:text-xl">
            {isAr ? 'احجز جلسة كوتشينج مع كوتشز معتمدين من أكاديمية كُن' : 'Book a coaching session with certified Kun Academy coaches'}
          </p>
        </div>
      </section>

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
