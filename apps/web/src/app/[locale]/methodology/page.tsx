import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';
import { FAQSection, faqJsonLd } from '@kunacademy/ui/faq-section';
import { methodologyFaqs } from '@/data/faqs';

export default async function MethodologyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      {/* Hero with Flower of Life pattern — sacred geometry for methodology */}
      <Section variant="surface" pattern="flower-of-life" hero>
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-sm font-medium tracking-widest uppercase text-[var(--color-accent)] mb-4">
            {isAr ? 'المنهجية' : 'The Methodology'}
          </p>
          <Heading level={1}>
            {isAr ? 'التفكير الحسّي®' : 'Somatic Thinking®'}
          </Heading>
          <p className="mt-6 text-lg text-[var(--color-neutral-700)] leading-relaxed">
            {isAr
              ? 'منهجية كوتشينج أصيلة تبدأ من الجسد — لأن التحوّل الحقيقي يُعاش، لا يُفكَّر فيه فقط'
              : 'An original coaching methodology that starts from the body — because real transformation is experienced, not just thought about'}
          </p>
        </div>
      </Section>

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
