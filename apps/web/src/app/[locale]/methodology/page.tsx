import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';
import { FAQSection } from '@kunacademy/ui/faq-section';
import { faqJsonLd } from '@kunacademy/ui/faq-jsonld';
import { methodologyFaqs } from '@/data/faqs';
import { GeometricPattern } from '@kunacademy/ui/patterns';

export default async function MethodologyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      {/* Hero with ink portrait */}
      <section className="relative overflow-hidden py-20 md:py-28 bg-[var(--color-background)]">
        <GeometricPattern pattern="flower-of-life" opacity={0.3} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6">
          <div className="flex flex-col md:flex-row items-center gap-10 md:gap-16">
            <div className="flex-1 text-center md:text-start animate-fade-up">
              <p className="text-sm font-medium tracking-[0.15em] uppercase text-[var(--color-accent)] mb-4">
                {isAr ? 'المنهجية' : 'The Methodology'}
              </p>
              <h1 className="text-[2.25rem] md:text-[3.5rem] font-bold text-[var(--text-accent)] leading-tight" style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
                {isAr ? 'التفكير الحسّي®' : 'Somatic Thinking®'}
              </h1>
              <p className="mt-6 text-[var(--color-neutral-700)] text-lg md:text-xl leading-relaxed max-w-lg">
                {isAr
                  ? 'منهجية كوتشينج أصيلة تبدأ من الجسد — لأن التحوّل الحقيقي يُعاش، لا يُفكَّر فيه فقط'
                  : 'An original coaching methodology that starts from the body — because real transformation is experienced, not just thought about'}
              </p>
            </div>
            {/* Ink portrait */}
            <div className="shrink-0 animate-scale">
              <div className="w-56 h-72 md:w-64 md:h-80 rounded-2xl overflow-hidden shadow-[0_12px_40px_rgba(71,64,153,0.12)]">
                <img
                  src="/images/methodology/ink-portrait-meditation.png"
                  alt={isAr ? 'التفكير الحسّي — الوعي الداخلي' : 'Somatic Thinking — Inner Awareness'}
                  className="w-full h-full object-cover"
                  loading="eager"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tonal layer shift: surface → surface-high */}
      <Section variant="surface-high">
        <div className="max-w-3xl mx-auto">
          <Heading level={2}>
            {isAr ? 'ما هو التفكير الحسّي؟' : 'What is Somatic Thinking?'}
          </Heading>
          <p className="mt-4 text-[var(--color-neutral-700)] leading-relaxed">
            {isAr
              ? 'التفكير الحسّي® هو منهجية كوتشينج طوّرها سامر حسن تعتمد على الإشارات الحسّية الجسدية كبوابة للوعي والتحوّل. الجسد يعرف قبل العقل — والمنهجية تعلّمك كيف تستمع لهذه المعرفة وتوظّفها في الكوتشينج والحياة.'
              : 'Somatic Thinking® is a coaching methodology developed by Samer Hassan that relies on somatic body signals as a gateway to awareness and transformation. The body knows before the mind — and this methodology teaches you how to listen to this knowledge and apply it in coaching and life.'}
          </p>
        </div>
      </Section>

      {/* Pillars with Girih pattern */}
      <Section variant="surface" pattern="girih">
        <div className="max-w-3xl mx-auto">
          <Heading level={2} className="text-center">
            {isAr ? 'الأركان الثلاثة' : 'The Three Pillars'}
          </Heading>
          <div className="mt-10 grid md:grid-cols-3 gap-8">
            {(isAr
              ? [
                { title: 'الجسد', desc: 'الإشارات الحسّية الجسدية كمصدر أول للمعلومات' },
                { title: 'النَّفْس', desc: 'فهم النَّفْس وطبقاتها من منظور توحيدي' },
                { title: 'العلاقة', desc: 'بناء علاقة كوتشينج قائمة على الحضور الحسّي' },
              ]
              : [
                { title: 'The Body', desc: 'Somatic body signals as the primary source of information' },
                { title: 'The Self', desc: 'Understanding the self and its layers from a Tawhidi perspective' },
                { title: 'The Relationship', desc: 'Building a coaching relationship grounded in somatic presence' },
              ]
            ).map((pillar, i) => (
              <div key={i} className="text-center p-8 rounded-2xl bg-white shadow-[0_4px_24px_rgba(71,64,153,0.06)] hover:shadow-[0_8px_32px_rgba(71,64,153,0.1)] hover:-translate-y-0.5 transition-all duration-500">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-600)] text-white font-bold text-xl">
                  {i + 1}
                </div>
                <h3 className="font-bold text-xl">{pillar.title}</h3>
                <p className="text-[var(--color-neutral-600)] mt-3 text-sm leading-relaxed">{pillar.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* FAQ on white surface */}
      <Section variant="white">
        <FAQSection items={methodologyFaqs} locale={locale} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(methodologyFaqs, locale)) }}
        />
      </Section>

      {/* CTA with eight-star pattern on dark */}
      <Section variant="dark" pattern="eight-star">
        <div className="text-center py-8">
          <Heading level={2} className="!text-white">
            {isAr ? 'ابدأ رحلتك مع التفكير الحسّي' : 'Begin Your Somatic Thinking Journey'}
          </Heading>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button variant="primary" size="lg">
              {isAr ? 'استكشف البرامج' : 'Explore Programs'}
            </Button>
            <Button variant="white" size="lg">
              {isAr ? 'اقرأ البحث العلمي' : 'Read the Research'}
            </Button>
          </div>
        </div>
      </Section>
    </main>
  );
}
