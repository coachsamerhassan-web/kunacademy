import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';
import { Card } from '@kunacademy/ui/card';
import { FAQSection, faqJsonLd } from '@kunacademy/ui/faq-section';
import { aboutFaqs } from '@/data/faqs';

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      {/* ── HERO ── */}
      <Section variant="surface" pattern="flower-of-life" hero>
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm font-medium tracking-widest uppercase text-[var(--color-accent)] mb-4">
            {isAr ? 'عن كُنْ' : 'About Kun'}
          </p>
          <Heading level={1} className="!text-[var(--color-primary)] !leading-[1.15]">
            {isAr ? 'نبني الحضور، ونترك الأثر.' : 'We build presence, and leave a lasting impact.'}
          </Heading>
          <p className="mt-6 text-lg text-[var(--color-neutral-700)] leading-relaxed">
            {isAr
              ? 'كُنْ، هي مساحة تربوية مأصّلة تُرافقك بخطى واعية، لا وصفات جاهزة.'
              : 'Kun is a rooted educational space that walks with you mindfully — no ready-made formulas.'}
          </p>
        </div>
      </Section>

      {/* ── WHO WE ARE ── */}
      <Section variant="white">
        <div className="max-w-3xl mx-auto">
          <p className="text-lg text-[var(--color-neutral-700)] leading-relaxed">
            {isAr
              ? 'كُنْ ليست مجرد أكاديمية، بل حركة تربوية معاصرة، تأسست عام 2014، تعيد تعريف التربية من الداخل، وتربط بين الجسد، والنية، والوعي، لتُثمر أثرًا متجذرًا.'
              : 'Kun is not just an academy — it is a contemporary educational movement, founded in 2014, redefining education from the inside, connecting body, intention, and awareness to produce deeply rooted impact.'}
          </p>
        </div>
      </Section>

      {/* ── WHY KUN — Vision & Mission Cards ── */}
      <Section variant="surface-high" pattern="girih">
        <div className="text-center mb-10">
          <Heading level={2}>
            {isAr ? 'لماذا كُنْ؟' : 'Why Kun?'}
          </Heading>
          <p className="mt-4 text-[var(--color-neutral-600)] max-w-2xl mx-auto">
            {isAr
              ? 'لأن الجذور وحدها تمنحك الثبات والنماء.'
              : 'Because only roots give you stability and growth.'}
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-8">
          <Card accent className="p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-[var(--color-primary)] flex items-center justify-center shrink-0">
                <span className="text-white text-lg">◎</span>
              </div>
              <Heading level={3} className="!mb-0">
                {isAr ? 'رؤيتنا' : 'Our Vision'}
              </Heading>
            </div>
            <p className="text-[var(--color-neutral-700)] leading-relaxed">
              {isAr
                ? 'أن يصبح التفكير الحسّي® الإطار المرجعي الأول للكوتشنغ في العالم العربي.'
                : 'To make Somatic Thinking® the primary coaching framework in the Arab world.'}
            </p>
          </Card>
          <Card accent className="p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-[var(--color-accent)] flex items-center justify-center shrink-0">
                <span className="text-white text-lg">↗</span>
              </div>
              <Heading level={3} className="!mb-0">
                {isAr ? 'مهمتنا' : 'Our Mission'}
              </Heading>
            </div>
            <p className="text-[var(--color-neutral-700)] leading-relaxed">
              {isAr
                ? 'في كُنْ، لا نقدّم لك مجرد محتوى، بل منهجية متكاملة تنبع من تراثنا وتلامس عمق تجربتك. نرافقك في رحلة تبدأ من الحضور الداخلي، وتمتد إلى التوازن، وتنتهي بأثر ملموس في حياتك وحياة من حولك.'
                : 'At Kun, we don\'t offer mere content — we offer a complete methodology rooted in our heritage that touches the depth of your experience. We accompany you on a journey that begins with inner presence, extends to balance, and culminates in tangible impact.'}
            </p>
          </Card>
        </div>
      </Section>

      {/* ── STATS — Primary gradient ── */}
      <Section variant="primary" pattern="eight-star">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {[
            { num: '+٥٠٠', numEn: '500+', ar: 'كوتش متخرّج', en: 'Coaches graduated' },
            { num: '٤', numEn: '4', ar: 'قارات', en: 'Continents' },
            { num: '٣', numEn: '3', ar: 'لغات', en: 'Languages' },
            { num: '+١٠,٠٠٠', numEn: '10,000+', ar: 'جلسة كوتشنغ', en: 'Coaching sessions' },
          ].map((stat) => (
            <div key={stat.en} className="text-center">
              <p className="text-4xl md:text-5xl font-bold text-white">
                {isAr ? stat.num : stat.numEn}
              </p>
              <p className="mt-2 text-white/75 text-sm">
                {isAr ? stat.ar : stat.en}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── ICF ACCREDITATION BANNER ── */}
      <Section variant="surface-low">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-[var(--color-neutral-700)] leading-relaxed">
            {isAr
              ? 'كُنْ مدرسة تدريب معتمدة دوليًا من الاتحاد الدولي للكوتشينج (ICF)، تقدم برامج معتمدة Level 1 و Level 2، وفق أعلى معايير التدريب المهني.'
              : 'Kun is an internationally accredited training school by the International Coaching Federation (ICF), offering Level 1 and Level 2 accredited programs to the highest professional training standards.'}
          </p>
        </div>
      </Section>

      {/* ── FAQ ── */}
      <Section variant="surface-high">
        <FAQSection items={aboutFaqs} locale={locale} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(aboutFaqs, locale)) }}
        />
      </Section>

      {/* ── CTA ── */}
      <Section variant="dark" pattern="girih">
        <div className="text-center py-8">
          <Heading level={2} className="!text-white">
            {isAr ? 'الرحلة لا تبدأ بالحماس، بل بلحظة حضور.' : 'The journey doesn\'t begin with excitement — it begins with a moment of presence.'}
          </Heading>
          <p className="mt-4 text-white/75 max-w-xl mx-auto">
            {isAr
              ? 'متى ما كنت مستعدًا، فـكُنْ معك.'
              : 'Whenever you\'re ready, Kun is with you.'}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button variant="primary" size="lg">
              {isAr ? 'ابدأ رحلتك' : 'Start Your Journey'}
            </Button>
            <Button variant="white" size="lg">
              {isAr ? 'تواصل معنا' : 'Contact Us'}
            </Button>
          </div>
        </div>
      </Section>
    </main>
  );
}
