import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Card } from '@kunacademy/ui/card';
import { breadcrumbJsonLd } from '@kunacademy/ui/structured-data';
import type { Metadata } from 'next';

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'التفكير الحسّي® | أكاديمية كُن' : 'Somatic Thinking® | Kun Academy',
    description: isAr
      ? 'التفكير الحسّي® — منهجية كوتشينج عربية أصيلة معتمدة من ICF، تبدأ من الجسد وتُعيد العلاقة بين الجسد والعقل والحضور'
      : 'Somatic Thinking® — an original Arabic coaching methodology accredited by ICF, starting from the body to restore the relationship between body, mind, and presence',
  };
}

const pillars = [
  {
    iconPath: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
    titleAr: 'الإشارات الحسّية الجسدية',
    titleEn: 'Somatic Signals',
    descAr: 'الجسد لا يكذب. كل شعور وكل قرار يبدأ كإشارة جسدية — التفكير الحسّي يُعلّمك قراءة هذه اللغة.',
    descEn: 'The body doesn\'t lie. Every feeling and every decision begins as a somatic signal — Somatic Thinking teaches you to read this language.',
  },
  {
    iconPath: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
    titleAr: 'الحضور',
    titleEn: 'Presence',
    descAr: 'الحضور هو الحالة الطبيعية — لا الاستثناء. المنهجية تُعيد الإنسان إلى حالة الحضور الكامل مع الذات والآخر.',
    descEn: 'Presence is the natural state — not the exception. The methodology restores the human to full presence with self and other.',
  },
  {
    iconPath: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z',
    titleAr: 'الشراكة بين الجسد والعقل',
    titleEn: 'Body-Mind Partnership',
    descAr: 'ليس الجسد تابعًا للعقل، ولا العقل سيّدًا على الجسد. التفكير الحسّي يُعيد بناء هذه الشراكة.',
    descEn: 'The body is not subordinate to the mind, nor is the mind master of the body. Somatic Thinking rebuilds this partnership.',
  },
  {
    iconPath: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
    titleAr: 'التجربة لا النظرية',
    titleEn: 'Experience, Not Theory',
    descAr: 'التفكير الحسّي يُعاش ولا يُشرَح. كل تمرين، كل جلسة، كل تعلّم يبدأ من تجربة حقيقية في الجسد.',
    descEn: 'Somatic Thinking is experienced, not explained. Every exercise, every session, every learning begins with a real experience in the body.',
  },
];

export default async function MethodologyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(locale, [
          { name: isAr ? 'الرئيسية' : 'Home', path: '' },
          { name: isAr ? 'عنّا' : 'About', path: '/about' },
          { name: isAr ? 'التفكير الحسّي' : 'Somatic Thinking', path: '/about/methodology' },
        ])) }}
      />
      {/* Hero */}
      <section className="relative overflow-hidden py-16 md:py-28">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, #1D1A3D 100%)' }} />
        <GeometricPattern pattern="flower-of-life" opacity={0.06} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center animate-fade-up">
          <p className="text-[var(--color-accent)] font-medium text-sm uppercase tracking-wider mb-4">
            {isAr ? 'المنهجية' : 'The Methodology'}
          </p>
          <h1
            className="text-[2.5rem] md:text-[4rem] font-bold text-[#FFF5E9] leading-[1.05]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'التفكير الحسّي®' : 'Somatic Thinking®'}
          </h1>
          <p className="mt-6 text-white/70 max-w-2xl mx-auto text-lg md:text-xl leading-relaxed">
            {isAr
              ? 'منهجية كوتشينج عربية أصيلة تبدأ من الجسد — معتمدة من الاتحاد الدولي للكوتشينج (ICF)'
              : 'An original Arabic coaching methodology that starts from the body — accredited by the International Coaching Federation (ICF)'}
          </p>
        </div>
      </section>

      {/* What is ST */}
      <Section variant="white">
        <div className="max-w-3xl mx-auto">
          <h2
            className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-6"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'ما هو التفكير الحسّي®؟' : 'What is Somatic Thinking®?'}
          </h2>
          <div
            className="text-[var(--color-neutral-700)] leading-relaxed text-base md:text-lg space-y-4"
            style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
          >
            {isAr ? (
              <>
                <p>
                  حين يسألني أحدهم «ما هو التفكير الحسّي؟» — أعرف أن الإجابة لن تكفيه. ليس لأنها معقّدة، بل لأنها تُعاش ولا تُشرَح.
                </p>
                <p>
                  تذكّر آخر مرة دخلت غرفة وشعرت أن شيئاً ليس على ما يرام — قبل أن يقول أحد كلمة. تذكّر لحظة اتخذت فيها قراراً «من بطنك» وكان صائباً. هذه ليست حدساً غامضاً. هذه إشارات حسّية جسدية — لغة يتحدّثها جسدك كل لحظة.
                </p>
                <p>
                  التفكير الحسّي® يُعيد فتح هذه القناة. المنهجية قائمة على مبدأ واحد: <strong>الحياة تُعاش في شراكة بين الجسد والعقل، بحيث يصبح الحضور هو الحالة السائدة — لا الاستثناء.</strong>
                </p>
              </>
            ) : (
              <>
                <p>
                  When someone asks me &ldquo;What is Somatic Thinking?&rdquo; — I know the answer won&apos;t be enough. Not because it&apos;s complex, but because it&apos;s experienced, not explained.
                </p>
                <p>
                  Remember the last time you walked into a room and felt something was off — before anyone said a word. Remember a moment you made a decision &ldquo;from your gut&rdquo; and it was right. These aren&apos;t vague intuitions. These are somatic signals — a language your body speaks every moment.
                </p>
                <p>
                  Somatic Thinking® reopens this channel. The methodology rests on one principle: <strong>Life is lived in partnership between body and mind, where presence becomes the prevailing state — not the exception.</strong>
                </p>
              </>
            )}
          </div>
        </div>
      </Section>

      {/* Pillars */}
      <Section variant="surface">
        <div className="text-center mb-10">
          <h2
            className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'أركان المنهجية' : 'Methodology Pillars'}
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {pillars.map((pillar, i) => (
            <Card key={i} accent className="p-6">
              <div className="h-12 w-12 rounded-xl bg-[var(--color-primary-50)] flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="currentColor">
                  <path d={pillar.iconPath} />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
                {isAr ? pillar.titleAr : pillar.titleEn}
              </h3>
              <p className="text-sm text-[var(--color-neutral-600)] leading-relaxed">
                {isAr ? pillar.descAr : pillar.descEn}
              </p>
            </Card>
          ))}
        </div>
      </Section>

      {/* Distinction */}
      <Section variant="white">
        <div className="max-w-3xl mx-auto">
          <h2
            className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-6"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'ما الذي يميّز التفكير الحسّي؟' : 'What Distinguishes Somatic Thinking?'}
          </h2>
          <div
            className="text-[var(--color-neutral-700)] leading-relaxed text-base md:text-lg space-y-4"
            style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
          >
            {isAr ? (
              <>
                <p>كثير من المناهج تتحدّث <em>عن</em> الجسد. التفكير الحسّي® لا يتحدّث عنه — بل يتحدّث <em>معه</em>.</p>
                <p>
                  نحن لا نستخدم مصطلح «الطاقة» ولا ندّعي أن الجسد يشفي نفسه بمعزل عن العقل.
                  نستخدم مصطلح <strong>«إشارات حسّية جسدية»</strong> — لأن العلم يُثبت أن الجسد يُرسل بيانات قابلة للقراءة والفهم،
                  وأن هذه البيانات أساسية لاتخاذ القرارات وللوعي بالذات وللقيادة.
                </p>
                <p>
                  المنهجية مبنية على فلسفة توحيدية — الإنسان كيان واحد متكامل، لا انفصال بين جسده وعقله ونَفْسه.
                </p>
              </>
            ) : (
              <>
                <p>Many methodologies talk <em>about</em> the body. Somatic Thinking® doesn&apos;t talk about it — it talks <em>with</em> it.</p>
                <p>
                  We don&apos;t use the term &ldquo;energy&rdquo; and we don&apos;t claim the body heals itself in isolation from the mind.
                  We use the term <strong>&ldquo;somatic signals&rdquo;</strong> — because science confirms the body sends readable, understandable data,
                  and this data is fundamental to decision-making, self-awareness, and leadership.
                </p>
                <p>
                  The methodology is built on a Tawhidi philosophy — the human is one integrated being, with no separation between body, mind, and self (النَّفْس).
                </p>
              </>
            )}
          </div>
        </div>
      </Section>

      {/* CTA */}
      <Section variant="surface">
        <div className="text-center py-4">
          <h2
            className="text-xl md:text-2xl font-bold text-[var(--text-primary)] mb-3"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'ابدأ تجربتك' : 'Start Your Experience'}
          </h2>
          <p className="text-[var(--color-neutral-600)] mb-6 max-w-xl mx-auto">
            {isAr
              ? 'التفكير الحسّي يُعاش — ابدأ بالتعرّف من خلال دورة تمهيدية أو جلسة كوتشينج فردية'
              : 'Somatic Thinking is experienced — start through an introductory course or an individual coaching session'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href={`/${locale}/academy/certifications/stce`}
              className="inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white min-h-[48px] hover:bg-[var(--color-primary-600)] transition-all duration-300"
            >
              {isAr ? 'برنامج STCE' : 'STCE Program'}
            </a>
            <a
              href={`/${locale}/coaching/individual`}
              className="inline-flex items-center justify-center rounded-xl border-2 border-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-[var(--color-primary)] min-h-[48px] hover:bg-[var(--color-primary-50)] transition-all duration-300"
            >
              {isAr ? 'جلسة كوتشينج فردية' : 'Individual Coaching Session'}
            </a>
          </div>
        </div>
      </Section>
    </main>
  );
}
