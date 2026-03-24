import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';
import { TrustBar } from '@kunacademy/ui/trust-bar';
import { TestimonialCard } from '@kunacademy/ui/card';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      {/* ── HERO — Editorial asymmetric layout per Stitch ── */}
      <Section variant="surface" pattern="flower-of-life" hero>
        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-16">
          {/* Text side — asymmetric, editorial */}
          <div className="flex-1 text-center md:text-start">
            <p className="text-sm font-medium tracking-widest uppercase text-[var(--color-accent)] mb-4">
              {isAr ? 'أكاديمية كُن للكوتشينج' : 'Kun Coaching Academy'}
            </p>
            <Heading level={1} className="!text-[var(--color-primary)] !leading-[1.15]">
              {isAr
                ? 'النمو لا يبدأ من الأعلى، بل من الجذور'
                : 'Growth doesn\'t start from the top — it starts from the roots'}
            </Heading>
            <p className="mt-6 text-lg text-[var(--color-neutral-700)] max-w-xl leading-relaxed">
              {isAr
                ? 'أكاديمية كُن — معتمدة دوليًا من ICF. نُخرّج كوتشز يجسّدون الإحسان في ممارستهم من خلال منهجية التفكير الحسّي®.'
                : 'ICF-accredited coaching academy. We develop coaches who embody Ihsan in their practice through the Somatic Thinking® methodology.'}
            </p>
            <div className="mt-8 flex flex-wrap justify-center md:justify-start gap-4">
              <Button variant="primary" size="lg">
                {isAr ? 'ابدأ رحلتك' : 'Start Your Journey'}
              </Button>
              <Button variant="secondary" size="lg">
                {isAr ? 'استكشف البرامج' : 'Explore Programs'}
              </Button>
            </div>
          </div>
          {/* Visual side — geometric accent */}
          <div className="hidden md:flex shrink-0 w-[360px] h-[360px] items-center justify-center relative">
            {/* Decorative eight-pointed star */}
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: `url("data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='360' height='360' viewBox='0 0 360 360'><path d='M180 0l50.3 129.7L360 180l-129.7 50.3L180 360l-50.3-129.7L0 180l129.7-50.3z' fill='#474099'/></svg>")}")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                backgroundSize: '100%',
              }}
              aria-hidden="true"
            />
            {/* Founder photo placeholder — to be replaced with actual photo */}
            <div className="relative z-10 w-64 h-64 rounded-2xl overflow-hidden bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-600)] flex items-center justify-center">
              <span className="text-7xl font-bold text-white/20">SH</span>
            </div>
          </div>
        </div>
      </Section>

      {/* ── TRUST BAR ── */}
      <TrustBar locale={locale} />

      {/* ── PROGRAM PATHWAY — Tonal stacking ── */}
      <Section variant="surface-high" pattern="girih">
        <div className="text-center mb-12">
          <Heading level={2}>
            {isAr ? 'مسار التطوّر' : 'Your Growth Pathway'}
          </Heading>
          <p className="mt-4 text-[var(--color-neutral-600)] max-w-2xl mx-auto">
            {isAr
              ? 'من الاكتشاف المجاني إلى الشهادات المعتمدة — اختر المسار الذي يناسبك'
              : 'From free discovery to accredited certifications — choose the path that fits you'}
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {(isAr
            ? [
                { label: 'مجاني', desc: 'اكتشف المنهجية', color: 'var(--color-secondary)' },
                { label: 'دورات', desc: 'تعلّم المهارات', color: 'var(--color-accent)' },
                { label: 'شهادات', desc: 'اعتماد دولي ICF', color: 'var(--color-primary)' },
                { label: 'المنصة', desc: 'مارس الكوتشينج', color: 'var(--color-primary-700)' },
              ]
            : [
                { label: 'Free', desc: 'Discover the methodology', color: 'var(--color-secondary)' },
                { label: 'Courses', desc: 'Learn the skills', color: 'var(--color-accent)' },
                { label: 'Certifications', desc: 'ICF accredited', color: 'var(--color-primary)' },
                { label: 'Platform', desc: 'Practice coaching', color: 'var(--color-primary-700)' },
              ]
          ).map((step, i) => (
            <div
              key={i}
              className="relative rounded-2xl bg-white p-6 text-center shadow-[0_4px_24px_rgba(71,64,153,0.06)] hover:shadow-[0_8px_32px_rgba(71,64,153,0.1)] hover:-translate-y-0.5 transition-all duration-500"
            >
              <div
                className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-white font-bold text-lg"
                style={{ backgroundColor: step.color }}
              >
                {i + 1}
              </div>
              <h3 className="font-bold text-lg">{step.label}</h3>
              <p className="text-sm text-[var(--color-neutral-600)] mt-1">{step.desc}</p>
              {i < 3 && (
                <div className="hidden md:block absolute top-1/2 -end-3 text-[var(--color-neutral-300)] text-lg">
                  ›
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* ── FOUNDER — Editorial layout ── */}
      <Section variant="surface-low">
        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-14">
          {/* Photo with geometric backdrop */}
          <div className="relative shrink-0">
            <div
              className="absolute -inset-4 opacity-[0.04] rounded-3xl"
              style={{
                backgroundImage: `url("data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><path d='M40 0l11.18 28.82L80 40 51.18 51.18 40 80 28.82 51.18 0 40l28.82-11.18z' fill='#474099'/></svg>")}")`,
                backgroundSize: '40px 40px',
              }}
              aria-hidden="true"
            />
            <div className="relative w-48 h-48 rounded-2xl overflow-hidden bg-gradient-to-br from-[var(--color-primary-100)] to-[var(--color-primary-200)]">
              {/* Replace with actual photo: <img src="/images/samer.jpg" alt="..." /> */}
              <div className="w-full h-full flex items-center justify-center text-6xl text-[var(--color-primary-300)] font-bold">
                SH
              </div>
            </div>
          </div>
          <div className="flex-1 text-center md:text-start">
            <Heading level={2}>
              {isAr ? 'سامر حسن' : 'Samer Hassan'}
            </Heading>
            <p className="text-[var(--color-accent)] font-medium mt-1">
              {isAr ? 'أول عربي MCC | مؤسس التفكير الحسّي®' : 'First Arab MCC | Founder of Somatic Thinking®'}
            </p>
            <p className="mt-4 text-[var(--color-neutral-700)] leading-relaxed max-w-xl">
              {isAr
                ? 'أكثر من ١٠,٠٠٠ جلسة كوتشينج. ٥٠٠+ كوتش تخرّجوا من أكاديمية كُن. حاصل على جائزة ICF Young Leader 2019.'
                : 'Over 10,000 coaching sessions. 500+ coaches graduated from Kun Academy. ICF Young Leader Award 2019.'}
            </p>
            <Button variant="ghost" className="mt-4">
              {isAr ? 'اعرف المزيد عن سامر' : 'Learn More About Samer'} →
            </Button>
          </div>
        </div>
      </Section>

      {/* ── SOCIAL PROOF — White surface layer ── */}
      <Section variant="white">
        <div className="text-center mb-10">
          <Heading level={2}>
            {isAr ? 'ماذا يقول خرّيجونا' : 'What Our Graduates Say'}
          </Heading>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <TestimonialCard
            authorName={isAr ? 'أحمد الشمري' : 'Ahmed Al-Shamri'}
            content={isAr
              ? 'التفكير الحسّي غيّر طريقة ممارستي للكوتشينج بالكامل. أصبحت أستمع لجسدي قبل عقلي.'
              : 'Somatic Thinking completely changed how I practice coaching. I now listen to my body before my mind.'}
            program="STCE Level 2"
            rating={5}
          />
          <TestimonialCard
            authorName={isAr ? 'نورة القحطاني' : 'Noura Al-Qahtani'}
            content={isAr
              ? 'شهادة معتمدة من ICF وتجربة تعليمية لا مثيل لها. أنصح بها كل كوتش طموح.'
              : 'ICF-accredited certification with an unmatched learning experience. I recommend it to every aspiring coach.'}
            program="STCE Level 1"
            rating={5}
          />
          <TestimonialCard
            authorName={isAr ? 'خالد المنصوري' : 'Khaled Al-Mansoori'}
            content={isAr
              ? 'برنامج الكوتشينج الإسلامي فتح لي آفاقًا جديدة في دمج القيم مع المنهجية العلمية.'
              : 'The Islamic Coaching program opened new horizons in integrating values with scientific methodology.'}
            program={isAr ? 'الكوتشينج الإسلامي' : 'Islamic Coaching'}
            rating={5}
          />
        </div>
      </Section>

      {/* ── CTA FOOTER — Dark gradient with pattern ── */}
      <Section variant="dark" pattern="eight-star">
        <div className="text-center py-8">
          <Heading level={2} className="!text-white">
            {isAr ? 'مستعد لبدء رحلتك؟' : 'Ready to Start Your Journey?'}
          </Heading>
          <p className="mt-4 text-white/75 max-w-xl mx-auto">
            {isAr
              ? 'انضم إلى أكثر من ٥٠٠ كوتش تدرّبوا في أكاديمية كُن من ٤ قارات'
              : 'Join 500+ coaches trained at Kun Academy from 4 continents'}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button variant="primary" size="lg">
              {isAr ? 'سجّل الآن' : 'Register Now'}
            </Button>
            <Button variant="white" size="lg">
              {isAr ? 'تواصل عبر واتساب' : 'Chat on WhatsApp'}
            </Button>
          </div>
        </div>
      </Section>
    </main>
  );
}
