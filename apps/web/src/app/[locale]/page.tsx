import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';
import { TrustBar } from '@kunacademy/ui/trust-bar';
import { TestimonialCard } from '@kunacademy/ui/card';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main>
      {/* ── HERO ── */}
      <Section variant="default" className="min-h-[80vh] flex items-center">
        <div className="text-center max-w-3xl mx-auto">
          <Heading level={1} className="!text-[var(--color-primary)] leading-[1.2]">
            {locale === 'ar'
              ? 'النمو لا يبدأ من الأعلى، بل من الجذور'
              : 'Growth doesn\'t start from the top — it starts from the roots'}
          </Heading>
          <p className="mt-6 text-lg text-[var(--color-neutral-700)]">
            {locale === 'ar'
              ? 'أكاديمية كوتشينج معتمدة دوليًا من ICF'
              : 'ICF-Accredited International Coaching Academy'}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button variant="primary" size="lg">
              {locale === 'ar' ? 'ابدأ رحلتك' : 'Start Your Journey'}
            </Button>
            <Button variant="secondary" size="lg">
              {locale === 'ar' ? 'استكشف البرامج' : 'Explore Programs'}
            </Button>
          </div>
        </div>
      </Section>

      {/* ── TRUST BAR ── */}
      <TrustBar locale={locale} />

      {/* ── PROGRAM PATHWAY ── */}
      <Section variant="white">
        <div className="text-center mb-12">
          <Heading level={2}>
            {locale === 'ar' ? 'مسار التطوّر' : 'Your Growth Pathway'}
          </Heading>
          <p className="mt-4 text-[var(--color-neutral-600)] max-w-2xl mx-auto">
            {locale === 'ar'
              ? 'من الاكتشاف المجاني إلى الشهادات المعتمدة — اختر المسار الذي يناسبك'
              : 'From free discovery to accredited certifications — choose the path that fits you'}
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(locale === 'ar'
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
              className="relative rounded-[var(--card-radius)] bg-white p-6 text-center shadow-sm hover:shadow-md transition-shadow"
            >
              <div
                className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full text-white font-bold"
                style={{ backgroundColor: step.color }}
              >
                {i + 1}
              </div>
              <h3 className="font-bold text-lg">{step.label}</h3>
              <p className="text-sm text-[var(--color-neutral-600)] mt-1">{step.desc}</p>
              {i < 3 && (
                <div className="hidden md:block absolute top-1/2 -end-2 text-[var(--color-neutral-400)]">
                  →
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* ── FOUNDER ── */}
      <Section variant="default">
        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
          <div className="w-48 h-48 rounded-full bg-[var(--color-primary-100)] shrink-0 flex items-center justify-center">
            <span className="text-6xl text-[var(--color-primary-300)]">SH</span>
          </div>
          <div className="flex-1 text-center md:text-start">
            <Heading level={2}>
              {locale === 'ar' ? 'سامر حسن' : 'Samer Hassan'}
            </Heading>
            <p className="text-[var(--color-accent)] font-medium mt-1">
              {locale === 'ar' ? 'أول عربي MCC | مؤسس التفكير الحسّي®' : 'First Arab MCC | Founder of Somatic Thinking®'}
            </p>
            <p className="mt-4 text-[var(--color-neutral-700)] leading-relaxed max-w-xl">
              {locale === 'ar'
                ? 'أكثر من ١٠,٠٠٠ جلسة كوتشينج. ٥٠٠+ كوتش تخرّجوا من أكاديمية كُن. حاصل على جائزة ICF Young Leader 2019.'
                : 'Over 10,000 coaching sessions. 500+ coaches graduated from Kun Academy. ICF Young Leader Award 2019.'}
            </p>
            <Button variant="ghost" className="mt-4">
              {locale === 'ar' ? 'اعرف المزيد عن سامر' : 'Learn More About Samer'} →
            </Button>
          </div>
        </div>
      </Section>

      {/* ── SOCIAL PROOF ── */}
      <Section variant="white">
        <div className="text-center mb-8">
          <Heading level={2}>
            {locale === 'ar' ? 'ماذا يقول خرّيجونا' : 'What Our Graduates Say'}
          </Heading>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <TestimonialCard
            authorName={locale === 'ar' ? 'أحمد الشمري' : 'Ahmed Al-Shamri'}
            content={locale === 'ar'
              ? 'التفكير الحسّي غيّر طريقة ممارستي للكوتشينج بالكامل. أصبحت أستمع لجسدي قبل عقلي.'
              : 'Somatic Thinking completely changed how I practice coaching. I now listen to my body before my mind.'}
            program="STCE Level 2"
            rating={5}
          />
          <TestimonialCard
            authorName={locale === 'ar' ? 'نورة القحطاني' : 'Noura Al-Qahtani'}
            content={locale === 'ar'
              ? 'شهادة معتمدة من ICF وتجربة تعليمية لا مثيل لها. أنصح بها كل كوتش طموح.'
              : 'ICF-accredited certification with an unmatched learning experience. I recommend it to every aspiring coach.'}
            program="STCE Level 1"
            rating={5}
          />
          <TestimonialCard
            authorName={locale === 'ar' ? 'خالد المنصوري' : 'Khaled Al-Mansoori'}
            content={locale === 'ar'
              ? 'برنامج الكوتشينج الإسلامي فتح لي آفاقًا جديدة في دمج القيم مع المنهجية العلمية.'
              : 'The Islamic Coaching program opened new horizons in integrating values with scientific methodology.'}
            program={locale === 'ar' ? 'الكوتشينج الإسلامي' : 'Islamic Coaching'}
            rating={5}
          />
        </div>
      </Section>

      {/* ── CTA FOOTER ── */}
      <Section variant="dark" pattern>
        <div className="text-center py-8">
          <Heading level={2} className="!text-white">
            {locale === 'ar' ? 'مستعد لبدء رحلتك؟' : 'Ready to Start Your Journey?'}
          </Heading>
          <p className="mt-4 text-white/80 max-w-xl mx-auto">
            {locale === 'ar'
              ? 'انضم إلى أكثر من ٥٠٠ كوتش تدرّبوا في أكاديمية كُن من ٤ قارات'
              : 'Join 500+ coaches trained at Kun Academy from 4 continents'}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button variant="primary" size="lg">
              {locale === 'ar' ? 'سجّل الآن' : 'Register Now'}
            </Button>
            <button className="inline-flex items-center gap-2 text-white/90 hover:text-white min-h-[44px] px-6 text-lg transition-colors">
              <span className="text-2xl">📱</span>
              {locale === 'ar' ? 'تواصل عبر واتساب' : 'Chat on WhatsApp'}
            </button>
          </div>
        </div>
      </Section>
    </main>
  );
}
